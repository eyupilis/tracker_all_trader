/**
 * Scheduler Service
 *
 * Replaces n8n's 60-second timer. Periodically scrapes all configured traders
 * from Binance and feeds data through the existing ingest pipeline.
 *
 * Architecture:
 *   scheduler → binanceScraper.scrapeTraders()
 *       → for each trader:
 *           1. upsertLeadTrader
 *           2. transformBinancePayload → insertPositionSnapshots + insertEvents
 *           3. prisma.rawIngest.create (stores full payload for dashboard)
 *           4. recomputeAggregations + updateTraderScore
 */

import { scrapeTraders, type BinanceScraperPayload } from './binanceScraper.js';
import { upsertLeadTrader } from './leadTrader.js';
import { insertPositionSnapshots } from './position.js';
import { insertEvents } from './event.js';
import { recomputeAggregations } from './aggregation.js';
import { updateTraderScore } from './traderScore.js';
import { updateTraderWeight } from './traderWeight.js';
import { monitorOpenPositions } from './positionMonitor.js';
import { trackPositionStates } from './positionState.js';
import { trackHiddenPositionStates } from './hiddenPositionState.js';
import { transformBinancePayload, type BinanceRawPayload } from '../schemas/ingest.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface SchedulerConfig {
  /** Interval between scrape cycles in milliseconds (default: 60_000) */
  intervalMs: number;
  /** Trader portfolio IDs to scrape */
  leadIds: string[];
  /** Max traders to scrape in parallel per batch (default: 5) */
  concurrency: number;
  /** Enable/disable the scheduler (default: true) */
  enabled: boolean;
  /** Order history page size per trader (default: 100, Binance max) */
  orderPageSize: number;
  /** Timeout per endpoint in ms (default: 15_000) */
  timeoutMs: number;
}

export interface CycleResult {
  cycle: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  tradersProcessed: number;
  tradersErrored: number;
  totalPositionsInserted: number;
  totalEventsInserted: number;
  totalEventsSkipped: number;
}

// ────────────────────────────────────────────────────────────
// Pipeline: process a single scraped trader payload
// ────────────────────────────────────────────────────────────

async function processTraderPayload(
  payload: BinanceScraperPayload,
): Promise<{
  positionsInserted: number;
  eventsInserted: number;
  eventsSkipped: number;
  positionStateUpdate: {
    newPositions: number;
    updatedPositions: number;
    closedPositions: number;
  };
  hiddenPositionStateUpdate: {
    newPositions: number;
    closedPositions: number;
  };
}> {
  const { leadId, fetchedAt } = payload;
  const fetchedAtDate = new Date(fetchedAt);

  // 1. Upsert lead trader record (FAZ 0: extract positionShow + nickname)
  const portfolioDetail = (payload as any).portfolioDetail as Record<string, unknown> | null;
  const positionShow = typeof portfolioDetail?.positionShow === 'boolean'
    ? portfolioDetail.positionShow as boolean
    : undefined;
  const nickname = typeof portfolioDetail?.nickname === 'string'
    ? portfolioDetail.nickname as string
    : undefined;

  await upsertLeadTrader(leadId, 'binance', { positionShow, nickname });

  // 2. Transform raw Binance format → normalized format for DB storage
  const normalized = transformBinancePayload(payload as unknown as BinanceRawPayload);

  // 3. Insert position snapshots
  const positionsInserted = await insertPositionSnapshots(
    normalized.positions,
    fetchedAtDate,
  );

  // 3b. YOL 2: Track position states for VISIBLE traders
  const positionStateUpdate = await trackPositionStates(
    normalized.positions,
    fetchedAtDate,
    'binance'
  );

  // 4. Insert events (with deduplication)
  const { inserted: eventsInserted, skipped: eventsSkipped } =
    await insertEvents(normalized.events, fetchedAtDate);

  // 4b. FAZ 1+2: Track HIDDEN trader positions from orderHistory events
  const hiddenPositionStateUpdate = await trackHiddenPositionStates(
    leadId,
    normalized.events,
    fetchedAtDate,
    'binance'
  );

  // 5. Store the COMPLETE raw payload (dashboard reads from this)
  const positionsCount = payload.activePositions?.length || 0;
  const ordersCount = payload.orderHistory?.allOrders?.length || 0;

  await prisma.rawIngest.create({
    data: {
      leadId,
      platform: 'binance',
      fetchedAt: fetchedAtDate,
      payload: payload as unknown as object,
      positionsCount,
      ordersCount,
      timeRange: payload.timeRange || null,
    },
  });

  // 6. Recompute aggregations + update trader score
  await recomputeAggregations('binance');
  await updateTraderScore(leadId, 'binance');

  // 7. FAZ 0: Update consensus weight
  await updateTraderWeight(leadId, 'binance');

  return {
    positionsInserted,
    eventsInserted,
    eventsSkipped,
    positionStateUpdate,
    hiddenPositionStateUpdate,
  };
}

// ────────────────────────────────────────────────────────────
// Scheduler class
// ────────────────────────────────────────────────────────────

export class BinanceScheduler {
  private config: SchedulerConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cycleCount = 0;
  private running = false;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * Start the scheduler. Runs one cycle immediately, then repeats at intervalMs.
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Scheduler is disabled (SCRAPER_ENABLED=false). Skipping.');
      return;
    }

    if (this.timer) {
      logger.warn('Scheduler already running');
      return;
    }

    const { leadIds, intervalMs } = this.config;
    logger.info(
      {
        traders: leadIds.length,
        intervalSec: Math.round(intervalMs / 1000),
        concurrency: this.config.concurrency,
      },
      '🚀 Binance scraper scheduler starting',
    );

    // Run first cycle immediately
    this.runCycle();

    // Schedule subsequent cycles
    this.timer = setInterval(() => {
      this.runCycle();
    }, intervalMs);
  }

  /**
   * Stop the scheduler gracefully.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info({ cyclesCompleted: this.cycleCount }, '⏹️  Scraper scheduler stopped');
    }
  }

  /**
   * Run a single scrape cycle for all configured traders.
   */
  private async runCycle(): Promise<void> {
    if (this.running) {
      logger.warn('Previous cycle still running, skipping this tick');
      return;
    }

    this.running = true;
    this.cycleCount++;
    const cycle = this.cycleCount;
    const startedAt = new Date().toISOString();
    const t0 = performance.now();

    logger.info({ cycle, traders: this.config.leadIds.length }, '🔄 Scrape cycle starting');

    let tradersProcessed = 0;
    let tradersErrored = 0;
    let totalPositionsInserted = 0;
    let totalEventsInserted = 0;
    let totalEventsSkipped = 0;

    try {
      // Scrape all traders with concurrency control
      const results = await scrapeTraders(
        this.config.leadIds,
        this.config.concurrency,
        {
          orderPageSize: this.config.orderPageSize,
          timeoutMs: this.config.timeoutMs,
        },
      );

      // Process each scraped payload through the ingest pipeline
      for (const result of results) {
        if (result.error || !result.payload) {
          tradersErrored++;
          logger.error({ leadId: result.leadId, error: result.error }, 'Trader scrape failed');
          continue;
        }

        try {
          const stats = await processTraderPayload(result.payload);
          tradersProcessed++;
          totalPositionsInserted += stats.positionsInserted;
          totalEventsInserted += stats.eventsInserted;
          totalEventsSkipped += stats.eventsSkipped;

          logger.debug(
            {
              leadId: result.leadId,
              positions: stats.positionsInserted,
              events: stats.eventsInserted,
            },
            'Trader processed',
          );
        } catch (err) {
          tradersErrored++;
          const msg = err instanceof Error ? err.message : String(err);
          logger.error({ leadId: result.leadId, error: msg }, 'Pipeline processing failed');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ cycle, error: msg }, 'Scrape cycle failed catastrophically');
    }

    // Sprint 1: Monitor open positions for SL/TP triggers
    try {
      const monitorResult = await monitorOpenPositions();
      logger.info(
        {
          checked: monitorResult.checked,
          closed: monitorResult.closed,
          updated: monitorResult.updated,
          errors: monitorResult.errors.length,
        },
        'Position monitoring complete'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ cycle, error: msg }, 'Position monitoring failed');
    }

    this.running = false;

    const durationMs = Math.round(performance.now() - t0);
    const cycleResult: CycleResult = {
      cycle,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      tradersProcessed,
      tradersErrored,
      totalPositionsInserted,
      totalEventsInserted,
      totalEventsSkipped,
    };

    logger.info(
      {
        cycle: cycleResult.cycle,
        duration: `${(durationMs / 1000).toFixed(1)}s`,
        processed: tradersProcessed,
        errored: tradersErrored,
        positions: totalPositionsInserted,
        events: totalEventsInserted,
      },
      `✅ Scrape cycle #${cycle} completed`,
    );
  }

  /** Get current status */
  getStatus() {
    return {
      enabled: this.config.enabled,
      running: this.running,
      cycleCount: this.cycleCount,
      traderCount: this.config.leadIds.length,
      intervalMs: this.config.intervalMs,
      concurrency: this.config.concurrency,
    };
  }
}
