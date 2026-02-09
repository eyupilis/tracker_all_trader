/**
 * Position Monitor Service (Sprint 1)
 * Real-time monitoring and trigger execution for simulated positions
 * DB-backed service following updateTraderWeight pattern
 */

import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { updateTrailingStop } from './riskCalculator.js';
import { computeExecutionCost } from './executionModel.js';

// ============================================================================
// Utility Functions
// ============================================================================

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Get current market price for a symbol
 * Reuses the existing getReferenceEntryPrice logic from signals.ts
 */
async function getCurrentPrice(symbol: string): Promise<number | null> {
  const s = symbol.toUpperCase();

  // Stage 1: Check latest 60 PositionSnapshots
  const latestPositions = await prisma.positionSnapshot.findMany({
    where: { symbol: s, platform: 'binance' },
    orderBy: { fetchedAt: 'desc' },
    take: 60,
    select: { markPrice: true, entryPrice: true },
  });

  const prices = latestPositions
    .map((p) => (p.markPrice && p.markPrice > 0 ? p.markPrice : p.entryPrice))
    .filter((v) => Number.isFinite(v) && v > 0);

  if (prices.length > 0) {
    const avg = prices.reduce((sum, v) => sum + v, 0) / prices.length;
    return round4(avg);
  }

  // Stage 2: Check latest Event with price
  const latestEvent = await prisma.event.findFirst({
    where: { symbol: s, platform: 'binance', price: { not: null } },
    orderBy: [{ eventTime: 'desc' }, { fetchedAt: 'desc' }],
    select: { price: true },
  });

  if (latestEvent?.price && latestEvent.price > 0) {
    return round4(latestEvent.price);
  }

  return null;
}

/**
 * Compute performance for a position (reusing existing logic)
 */
export function computeSimulationPerformance(params: {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  leverage: number;
  marginNotional: number;
}) {
  const { direction, entryPrice, exitPrice, leverage, marginNotional } = params;
  const positionNotional = marginNotional * Math.max(leverage, 1);

  const rawMove =
    direction === 'LONG'
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;

  const pnlUSDT = positionNotional * rawMove;
  const roiPct = marginNotional > 0 ? (pnlUSDT / marginNotional) * 100 : 0;

  return {
    positionNotional: round4(positionNotional),
    pnlUSDT: round4(pnlUSDT),
    roiPct: round4(roiPct),
  };
}

// ============================================================================
// Position Monitoring
// ============================================================================

export interface MonitorResult {
  checked: number;
  closed: number;
  updated: number;
  errors: string[];
}

/**
 * Main monitoring function - checks all open positions for SL/TP triggers
 * Called by scheduler every 60 seconds
 */
export async function monitorOpenPositions(): Promise<MonitorResult> {
  const result: MonitorResult = {
    checked: 0,
    closed: 0,
    updated: 0,
    errors: [],
  };

  try {
    // Query all OPEN positions with risk management enabled
    const openPositions = await prisma.simulatedPosition.findMany({
      where: {
        platform: 'binance',
        status: 'OPEN',
        OR: [
          { stopLossPrice: { not: null } },
          { takeProfitPrice: { not: null } },
          { trailingStopPct: { not: null } },
        ],
      },
      orderBy: { openedAt: 'asc' },
      take: 500,
    });

    if (openPositions.length === 0) {
      logger.debug('No open positions with risk management to monitor');
      return result;
    }

    // Group positions by symbol for batch price fetching
    const symbolMap = new Map<string, typeof openPositions>();
    for (const pos of openPositions) {
      if (!symbolMap.has(pos.symbol)) {
        symbolMap.set(pos.symbol, []);
      }
      symbolMap.get(pos.symbol)!.push(pos);
    }

    // Fetch current prices for all unique symbols
    const priceMap = new Map<string, number>();
    for (const symbol of symbolMap.keys()) {
      const price = await getCurrentPrice(symbol);
      if (price) {
        priceMap.set(symbol, price);
      }
    }

    // Check each position
    for (const position of openPositions) {
      result.checked++;

      const currentPrice = priceMap.get(position.symbol);
      if (!currentPrice) {
        result.errors.push(`No price data for ${position.symbol}`);
        continue;
      }

      try {
        // Check for triggers
        const triggerResult = await checkPositionTriggers(
          position,
          currentPrice
        );

        if (triggerResult.triggered && triggerResult.exitPrice) {
          // Close position
          await closePositionWithExecution(
            position,
            triggerResult.exitPrice,
            triggerResult.reason!
          );
          result.closed++;
        } else if (triggerResult.updated) {
          // Trailing stop updated (but not triggered)
          result.updated++;
        }

        // Update lastPriceUpdate and lastPriceCheckAt
        await prisma.simulatedPosition.update({
          where: { id: position.id },
          data: {
            lastPriceUpdate: currentPrice,
            lastPriceCheckAt: new Date(),
          },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Position ${position.id}: ${msg}`);
        logger.error(
          { positionId: position.id, error: msg },
          'Error checking position triggers'
        );
      }
    }

    logger.info(
      {
        checked: result.checked,
        closed: result.closed,
        updated: result.updated,
        errors: result.errors.length,
      },
      'Position monitoring cycle complete'
    );

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ error: msg }, 'Position monitoring failed');
    result.errors.push(msg);
    return result;
  }
}

/**
 * Check single position for stop-loss, take-profit, and trailing stop triggers
 */
async function checkPositionTriggers(
  position: any,
  currentPrice: number
): Promise<{
  triggered: boolean;
  reason?: string;
  exitPrice?: number;
  updated?: boolean;
}> {
  const direction = position.direction as 'LONG' | 'SHORT';

  // Check Stop Loss
  if (position.stopLossPrice) {
    const isStopLossTriggered =
      direction === 'LONG'
        ? currentPrice <= position.stopLossPrice
        : currentPrice >= position.stopLossPrice;

    if (isStopLossTriggered) {
      return {
        triggered: true,
        reason: 'STOP_LOSS',
        exitPrice: position.stopLossPrice,
      };
    }
  }

  // Check Take Profit
  if (position.takeProfitPrice) {
    const isTakeProfitTriggered =
      direction === 'LONG'
        ? currentPrice >= position.takeProfitPrice
        : currentPrice <= position.takeProfitPrice;

    if (isTakeProfitTriggered) {
      return {
        triggered: true,
        reason: 'TAKE_PROFIT',
        exitPrice: position.takeProfitPrice,
      };
    }
  }

  // Check Trailing Stop
  if (position.trailingStopPct) {
    const trailingResult = updateTrailingStop({
      currentPrice,
      entryPrice: position.entryPrice,
      direction,
      trailingPct: position.trailingStopPct,
      currentTrigger: position.trailingStopTrigger,
    });

    if (trailingResult.isTriggered) {
      return {
        triggered: true,
        reason: 'TRAILING_STOP',
        exitPrice: trailingResult.newStopPrice,
      };
    }

    // Update trailing stop trigger if price moved favorably
    if (trailingResult.shouldUpdate) {
      await prisma.simulatedPosition.update({
        where: { id: position.id },
        data: {
          trailingStopTrigger: trailingResult.newTrigger,
          stopLossPrice: trailingResult.newStopPrice, // Update SL to trailing level
        },
      });

      logger.debug(
        {
          positionId: position.id,
          symbol: position.symbol,
          newTrigger: trailingResult.newTrigger,
          newStopPrice: trailingResult.newStopPrice,
        },
        'Trailing stop updated'
      );

      return { triggered: false, updated: true };
    }
  }

  return { triggered: false };
}

/**
 * Close position with realistic execution modeling (slippage + commission)
 */
async function closePositionWithExecution(
  position: any,
  exitPrice: number,
  reason: string
): Promise<void> {
  const direction = position.direction as 'LONG' | 'SHORT';

  // Apply execution model
  const executionCost = computeExecutionCost({
    entryPrice: position.entryPrice,
    exitPrice,
    direction,
    positionNotional: position.positionNotional,
    slippageBps: position.slippageBps || 10,
    commissionBps: position.commissionBps || 4,
  });

  // Update position
  await prisma.simulatedPosition.update({
    where: { id: position.id },
    data: {
      status: 'CLOSED',
      exitPrice: round4(exitPrice),
      effectiveExitPrice: executionCost.effectiveExitPrice,
      totalCommissionUSDT: executionCost.totalCommissionUSDT,
      pnlUSDT: executionCost.netPnlUSDT,
      roiPct: round4(
        (executionCost.netPnlUSDT / position.marginNotional) * 100
      ),
      closedAt: new Date(),
      closeReason: reason,
    },
  });

  logger.info(
    {
      positionId: position.id,
      symbol: position.symbol,
      direction,
      reason,
      exitPrice: round4(exitPrice),
      netPnl: executionCost.netPnlUSDT,
      totalCost: executionCost.totalCostUSDT,
    },
    'Position closed by trigger'
  );

  // Update portfolio balance if applicable
  if (position.portfolioId) {
    try {
      const portfolio = await prisma.portfolio.findUnique({
        where: { id: position.portfolioId },
      });

      if (portfolio) {
        const newBalance =
          portfolio.currentBalance +
          position.marginNotional +
          executionCost.netPnlUSDT;

        await prisma.portfolio.update({
          where: { id: position.portfolioId },
          data: { currentBalance: round4(newBalance) },
        });
      }
    } catch (error) {
      logger.error(
        { portfolioId: position.portfolioId, error },
        'Failed to update portfolio balance'
      );
    }
  }
}
