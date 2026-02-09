/**
 * Binance Copy-Trade Scraper Service
 *
 * Direct replacement for the n8n workflow.
 * Fetches all 6 public Binance copy-trade endpoints for a given trader,
 * produces a payload identical to what n8n's "Build Final Payload" node produced.
 *
 * All endpoints are 100% public — zero authentication required.
 */

import { logger } from '../utils/logger.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface BinanceScraperPayload {
  leadId: string;
  fetchedAt: string; // ISO 8601
  timeRange: string;
  startTime: number;
  endTime: number;
  leadCommon: Record<string, unknown> | null;
  portfolioDetail: Record<string, unknown> | null;
  activePositions: RawPosition[];
  positionAudit: PositionAudit;
  roiSeries: Record<string, unknown>[];
  assetPreferences: Record<string, unknown> | null;
  orderHistory: {
    total: number;
    allOrders: RawOrder[];
  };
}

export interface RawPosition {
  id?: string;
  symbol: string;
  collateral?: string;
  positionAmount: string;
  entryPrice: string;
  markPrice: string;
  leverage: number;
  isolated?: boolean;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  unrealizedProfit?: string;
  cumRealized?: string;
  notionalValue?: string;
  breakEvenPrice?: string;
  adl?: number;
}

export interface RawOrder {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
  side: 'BUY' | 'SELL';
  type?: string;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  executedQty: number;
  avgPrice: number;
  totalPnl?: number;
  orderUpdateTime: number;
  orderTime?: number;
}

export interface PositionAudit {
  sourceRawPositionsCount: number;
  filteredActivePositionsCount: number;
  droppedPositionsCount: number;
  nonZeroByAmountCount: number;
  nonZeroByNotionalCount: number;
  nonZeroByUnrealizedCount: number;
  droppedBecauseAllZeroCount: number;
}

export interface ScraperOptions {
  timeRange?: string; // default '30D'
  orderPageSize?: number; // default 100 (max Binance allows)
  timeoutMs?: number; // default 15_000
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const BASE = 'https://www.binance.com/bapi/futures/v1';

const ENDPOINTS = {
  leadCommon: (id: string) =>
    `${BASE}/friendly/future/spot-copy-trade/common/spot-futures-last-lead?portfolioId=${id}`,
  portfolioDetail: (id: string) =>
    `${BASE}/friendly/future/copy-trade/lead-portfolio/detail?portfolioId=${id}`,
  positions: (id: string) =>
    `${BASE}/friendly/future/copy-trade/lead-data/positions?portfolioId=${id}`,
  roiSeries: (id: string, range: string) =>
    `${BASE}/public/future/copy-trade/lead-portfolio/chart-data?dataType=ROI&portfolioId=${id}&timeRange=${range}`,
  assetPreferences: (id: string, range: string) =>
    `${BASE}/public/future/copy-trade/lead-portfolio/performance/coin?portfolioId=${id}&timeRange=${range}`,
  orderHistory: () =>
    `${BASE}/friendly/future/copy-trade/lead-portfolio/order-history`,
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function fetchJson<T = unknown>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15_000,
): Promise<{ success: boolean; data: T | null; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { success: false, data: null, error: `HTTP ${res.status}` };
    }

    const json = (await res.json()) as { success?: boolean; data?: T };
    if (json.success === false) {
      return { success: false, data: null, error: 'Binance API returned success=false' };
    }

    return { success: true, data: json.data ?? (json as unknown as T) };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, data: null, error: message };
  }
}

/**
 * Filter out zero-amount / zero-notional / zero-pnl positions
 * (mirrors the n8n "Filter Active Positions" node)
 */
function filterActivePositions(raw: RawPosition[]): {
  active: RawPosition[];
  audit: PositionAudit;
} {
  let nonZeroByAmount = 0;
  let nonZeroByNotional = 0;
  let nonZeroByUnrealized = 0;
  let droppedBecauseAllZero = 0;

  const active = raw.filter((p) => {
    const amt = parseFloat(p.positionAmount) || 0;
    const notional = parseFloat(p.notionalValue ?? '0') || 0;
    const pnl = parseFloat(p.unrealizedProfit ?? '0') || 0;

    if (amt !== 0) nonZeroByAmount++;
    if (notional !== 0) nonZeroByNotional++;
    if (pnl !== 0) nonZeroByUnrealized++;

    const isActive = amt !== 0 || notional !== 0 || pnl !== 0;
    if (!isActive) droppedBecauseAllZero++;
    return isActive;
  });

  return {
    active,
    audit: {
      sourceRawPositionsCount: raw.length,
      filteredActivePositionsCount: active.length,
      droppedPositionsCount: raw.length - active.length,
      nonZeroByAmountCount: nonZeroByAmount,
      nonZeroByNotionalCount: nonZeroByNotional,
      nonZeroByUnrealizedCount: nonZeroByUnrealized,
      droppedBecauseAllZeroCount: droppedBecauseAllZero,
    },
  };
}

/**
 * Fetch order history (single page, max 100 orders — Binance's server-side limit).
 * Pagination cursors don't work from server-side, so we grab the max single page.
 */
async function fetchOrderHistory(
  leadId: string,
  startTime: number,
  endTime: number,
  pageSize: number,
  timeoutMs: number,
): Promise<{ total: number; allOrders: RawOrder[] }> {
  const body = {
    portfolioId: leadId,
    startTime,
    endTime,
    pageSize: Math.min(pageSize, 100), // Binance max is 100
  };

  const res = await fetchJson<{
    total?: number;
    list?: RawOrder[];
  }>(
    ENDPOINTS.orderHistory(),
    { method: 'POST', body: JSON.stringify(body) },
    timeoutMs,
  );

  if (!res.success || !res.data) {
    logger.warn({ leadId, error: res.error }, 'Order history fetch failed');
    return { total: 0, allOrders: [] };
  }

  return {
    total: res.data.total || 0,
    allOrders: res.data.list || [],
  };
}

// ────────────────────────────────────────────────────────────
// Main scraper function
// ────────────────────────────────────────────────────────────

/**
 * Fetch ALL data for a single trader from Binance public API.
 *
 * Returns a payload identical in shape to what n8n's "Build Final Payload" node produced,
 * so it plugs directly into the existing ingest pipeline.
 */
export async function scrapeTrader(
  leadId: string,
  options: ScraperOptions = {},
): Promise<BinanceScraperPayload> {
  const {
    timeRange = '30D',
    orderPageSize = 100,
    timeoutMs = 15_000,
  } = options;

  const now = Date.now();
  const endTime = now;
  const startTime = now - 30 * 24 * 60 * 60 * 1000; // 30 days
  const fetchedAt = new Date(now).toISOString();

  // Fetch ALL endpoints in parallel (including order history — single page)
  const [leadCommonRes, portfolioRes, positionsRes, roiRes, assetsRes, orderHistory] =
    await Promise.all([
      fetchJson<Record<string, unknown>>(ENDPOINTS.leadCommon(leadId), {}, timeoutMs),
      fetchJson<Record<string, unknown>>(ENDPOINTS.portfolioDetail(leadId), {}, timeoutMs),
      fetchJson<RawPosition[]>(ENDPOINTS.positions(leadId), {}, timeoutMs),
      fetchJson<Record<string, unknown>[]>(ENDPOINTS.roiSeries(leadId, timeRange), {}, timeoutMs),
      fetchJson<Record<string, unknown>>(ENDPOINTS.assetPreferences(leadId, timeRange), {}, timeoutMs),
      fetchOrderHistory(leadId, startTime, endTime, orderPageSize, timeoutMs),
    ]);

  // Filter active positions
  const rawPositions = (positionsRes.data as RawPosition[]) || [];
  const { active: activePositions, audit: positionAudit } =
    filterActivePositions(rawPositions);

  // Log any failures
  const results = {
    leadCommon: leadCommonRes.success,
    portfolio: portfolioRes.success,
    positions: positionsRes.success,
    roi: roiRes.success,
    assets: assetsRes.success,
  };
  const failures = Object.entries(results).filter(([, ok]) => !ok);
  if (failures.length > 0) {
    logger.warn(
      { leadId, failures: failures.map(([k]) => k) },
      'Some endpoints failed for trader',
    );
  }

  return {
    leadId,
    fetchedAt,
    timeRange,
    startTime,
    endTime,
    leadCommon: leadCommonRes.data ?? null,
    portfolioDetail: portfolioRes.data ?? null,
    activePositions,
    positionAudit,
    roiSeries: (roiRes.data as Record<string, unknown>[]) || [],
    assetPreferences: assetsRes.data ?? null,
    orderHistory,
  };
}

/**
 * Scrape multiple traders with concurrency control.
 *
 * @param leadIds - Array of Binance portfolio IDs to scrape
 * @param concurrency - Max number of traders to scrape in parallel (default 5)
 * @param options - Per-trader scraper options
 * @returns Array of results (payload or error per trader)
 */
export async function scrapeTraders(
  leadIds: string[],
  concurrency: number = 5,
  options: ScraperOptions = {},
): Promise<{ leadId: string; payload?: BinanceScraperPayload; error?: string }[]> {
  const results: { leadId: string; payload?: BinanceScraperPayload; error?: string }[] = [];

  // Process in batches of `concurrency`
  for (let i = 0; i < leadIds.length; i += concurrency) {
    const batch = leadIds.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (leadId) => {
        const payload = await scrapeTrader(leadId, options);
        return { leadId, payload };
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const leadId = batch[batchResults.indexOf(result)];
        const error = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        logger.error({ leadId, error }, 'Failed to scrape trader');
        results.push({ leadId, error });
      }
    }

    // Small delay between batches to be nice to Binance
    if (i + concurrency < leadIds.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}
