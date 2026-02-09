/**
 * Trader Performance Metrics Service
 *
 * Calculates key performance indicators for traders:
 * - 30D ROI, PnL, Sharpe, Max Drawdown
 * - Win Rate, Avg Win/Loss
 * - Trade frequency metrics
 */

import { prisma } from '../db/prisma.js';

export interface TraderPerformanceMetrics {
  leadId: string;

  // Returns
  roi30d: number | null;           // 30-day ROI percentage
  pnl30d: number | null;           // 30-day total PnL in USDT
  sharpeRatio: number | null;      // Risk-adjusted returns

  // Risk
  maxDrawdown: number | null;      // Max drawdown percentage
  avgLeverage: number | null;      // Average leverage used

  // Trade metrics
  totalTrades: number;             // Total closed positions
  winRate: number | null;          // Win/loss ratio
  avgWin: number | null;           // Average winning trade
  avgLoss: number | null;          // Average losing trade
  profitFactor: number | null;     // Gross profit / gross loss

  // Activity
  tradesPerDay: number | null;     // Average trades per day
  closesPerDay: number | null;     // Average closes per day
  avgHoldTime: number | null;      // Average position hold time (seconds)

  // Sample info
  sampleSize: number;              // Number of positions analyzed
  dataFrom: Date | null;           // Earliest data point
  dataTo: Date | null;             // Latest data point
}

/**
 * Calculate performance metrics for a trader based on PositionState history
 */
export async function calculateTraderPerformance(
  leadId: string,
  daysBack: number = 30
): Promise<TraderPerformanceMetrics> {
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // Get closed positions from last N days
  const closedPositions = await prisma.positionState.findMany({
    where: {
      leadId,
      status: 'CLOSED',
      disappearedAt: { gte: cutoffDate },
    },
    select: {
      entryPrice: true,
      amount: true,
      leverage: true,
      estimatedOpenTime: true,
      estimatedCloseTime: true,
      disappearedAt: true,
      firstSeenAt: true,
      lastSeenAt: true,
    },
    orderBy: {
      disappearedAt: 'asc',
    },
  });

  if (closedPositions.length === 0) {
    return {
      leadId,
      roi30d: null,
      pnl30d: null,
      sharpeRatio: null,
      maxDrawdown: null,
      avgLeverage: null,
      totalTrades: 0,
      winRate: null,
      avgWin: null,
      avgLoss: null,
      profitFactor: null,
      tradesPerDay: null,
      closesPerDay: null,
      avgHoldTime: null,
      sampleSize: 0,
      dataFrom: null,
      dataTo: null,
    };
  }

  // Calculate basic metrics
  const totalTrades = closedPositions.length;

  // Calculate average leverage
  const leverages = closedPositions
    .map(p => p.leverage)
    .filter((l): l is number => l !== null && l > 0);
  const avgLeverage = leverages.length > 0
    ? leverages.reduce((sum, l) => sum + l, 0) / leverages.length
    : null;

  // Calculate hold times
  const holdTimes = closedPositions
    .map(p => {
      const openTime = p.estimatedOpenTime || p.firstSeenAt;
      const closeTime = p.estimatedCloseTime || p.disappearedAt;
      if (!closeTime) return null;
      return (closeTime.getTime() - openTime.getTime()) / 1000;
    })
    .filter((t): t is number => t !== null && t > 0);

  const avgHoldTime = holdTimes.length > 0
    ? holdTimes.reduce((sum, t) => sum + t, 0) / holdTimes.length
    : null;

  // Calculate dates
  const dataFrom = closedPositions[0]?.estimatedOpenTime || closedPositions[0]?.firstSeenAt || null;
  const dataTo = closedPositions[closedPositions.length - 1]?.disappearedAt || null;

  // Calculate trade frequency
  const daySpan = dataFrom && dataTo
    ? Math.max(1, (dataTo.getTime() - dataFrom.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const tradesPerDay = daySpan ? totalTrades / daySpan : null;
  const closesPerDay = tradesPerDay; // Same for now

  // Calculate PnL-based metrics from Event.realizedPnl
  const closeEvents = await prisma.event.findMany({
    where: {
      leadId,
      eventType: { in: ['CLOSE_LONG', 'CLOSE_SHORT'] },
      eventTime: { gte: cutoffDate },
      realizedPnl: { not: null },
    },
    select: {
      realizedPnl: true,
      eventTime: true,
    },
    orderBy: {
      eventTime: 'asc',
    },
  });

  // Calculate PnL metrics
  let pnl30d = 0;
  let wins = 0;
  let losses = 0;
  let totalWinAmount = 0;
  let totalLossAmount = 0;
  const returns: number[] = [];
  const equity: number[] = [10000]; // Assume starting capital of 10000 USDT

  for (const event of closeEvents) {
    const pnl = event.realizedPnl || 0;
    pnl30d += pnl;

    // Track wins/losses
    if (pnl > 0) {
      wins++;
      totalWinAmount += pnl;
    } else if (pnl < 0) {
      losses++;
      totalLossAmount += Math.abs(pnl);
    }

    // Track equity curve
    const newEquity = equity[equity.length - 1] + pnl;
    equity.push(newEquity);

    // Track returns for Sharpe
    const returnPct = equity[equity.length - 2] > 0
      ? pnl / equity[equity.length - 2]
      : 0;
    returns.push(returnPct);
  }

  // Calculate ROI
  const roi30d = equity.length > 1
    ? ((equity[equity.length - 1] - equity[0]) / equity[0]) * 100
    : null;

  // Calculate win rate
  const totalPnlTrades = wins + losses;
  const winRate = totalPnlTrades > 0 ? wins / totalPnlTrades : null;

  // Calculate avg win/loss
  const avgWin = wins > 0 ? totalWinAmount / wins : null;
  const avgLoss = losses > 0 ? totalLossAmount / losses : null;

  // Calculate profit factor
  const profitFactor = totalLossAmount > 0
    ? totalWinAmount / totalLossAmount
    : null;

  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = equity[0];
  for (const eq of equity) {
    if (eq > peak) peak = eq;
    const drawdown = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Calculate Sharpe ratio (simplified - assumes 0% risk-free rate)
  let sharpeRatio: number | null = null;
  if (returns.length >= 10) {
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) =>
      sum + Math.pow(r - avgReturn, 2), 0
    ) / returns.length;
    const stdDev = Math.sqrt(variance);
    sharpeRatio = stdDev > 0
      ? (avgReturn / stdDev) * Math.sqrt(252) // Annualized (assuming daily trades)
      : null;
  }

  return {
    leadId,
    roi30d: roi30d !== null ? Math.round(roi30d * 100) / 100 : null,
    pnl30d: Math.round(pnl30d * 100) / 100,
    sharpeRatio: sharpeRatio !== null ? Math.round(sharpeRatio * 100) / 100 : null,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    avgLeverage: avgLeverage ? Math.round(avgLeverage * 10) / 10 : null,
    totalTrades: Math.max(totalTrades, totalPnlTrades), // Use max of PositionState or Event counts
    winRate: winRate !== null ? Math.round(winRate * 10000) / 10000 : null,
    avgWin: avgWin !== null ? Math.round(avgWin * 100) / 100 : null,
    avgLoss: avgLoss !== null ? Math.round(avgLoss * 100) / 100 : null,
    profitFactor: profitFactor !== null ? Math.round(profitFactor * 100) / 100 : null,
    tradesPerDay: tradesPerDay ? Math.round(tradesPerDay * 10) / 10 : null,
    closesPerDay: closesPerDay ? Math.round(closesPerDay * 10) / 10 : null,
    avgHoldTime: avgHoldTime ? Math.round(avgHoldTime) : null,
    sampleSize: Math.max(totalTrades, totalPnlTrades),
    dataFrom,
    dataTo,
  };
}

/**
 * Batch calculate performance metrics for multiple traders
 */
export async function batchCalculatePerformance(
  leadIds: string[],
  daysBack: number = 30
): Promise<Map<string, TraderPerformanceMetrics>> {
  const results = new Map<string, TraderPerformanceMetrics>();

  // Process in parallel (but limit concurrency to avoid DB overload)
  const chunks: string[][] = [];
  const chunkSize = 10;
  for (let i = 0; i < leadIds.length; i += chunkSize) {
    chunks.push(leadIds.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(leadId => calculateTraderPerformance(leadId, daysBack))
    );
    chunkResults.forEach(metrics => results.set(metrics.leadId, metrics));
  }

  return results;
}
