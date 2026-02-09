/**
 * Portfolio Manager Service (Sprint 1)
 * Portfolio operations, balance updates, metrics calculation
 * DB-backed service following existing service patterns
 */

import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Utility Functions
// ============================================================================

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ============================================================================
// Portfolio CRUD
// ============================================================================

/**
 * Get or create the default portfolio
 */
export async function getOrCreateDefaultPortfolio() {
  const existing = await prisma.portfolio.findUnique({
    where: { id: 'default' },
  });

  if (existing) return existing;

  // Create default portfolio
  return prisma.portfolio.create({
    data: {
      id: 'default',
      name: 'Default',
      platform: 'binance',
      initialBalance: 10000,
      currentBalance: 10000,
    },
  });
}

/**
 * Get portfolio by ID
 */
export async function getPortfolio(portfolioId: string) {
  return prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: {
      metrics: true,
      positions: {
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      },
    },
  });
}

/**
 * Create a new portfolio
 */
export async function createPortfolio(data: {
  name: string;
  initialBalance?: number;
  maxRiskPerTrade?: number;
  maxPortfolioRisk?: number;
  maxOpenPositions?: number;
  maxLeverageAllowed?: number;
  defaultSlippageBps?: number;
  defaultCommissionBps?: number;
  kellyFraction?: number;
  minSampleSize?: number;
}) {
  const portfolio = await prisma.portfolio.create({
    data: {
      name: data.name,
      platform: 'binance',
      initialBalance: data.initialBalance ?? 10000,
      currentBalance: data.initialBalance ?? 10000,
      maxRiskPerTrade: data.maxRiskPerTrade ?? 2.0,
      maxPortfolioRisk: data.maxPortfolioRisk ?? 10.0,
      maxOpenPositions: data.maxOpenPositions ?? 5,
      maxLeverageAllowed: data.maxLeverageAllowed ?? 20.0,
      defaultSlippageBps: data.defaultSlippageBps ?? 10,
      defaultCommissionBps: data.defaultCommissionBps ?? 4,
      kellyFraction: data.kellyFraction ?? 0.25,
      minSampleSize: data.minSampleSize ?? 20,
    },
  });

  // Create initial metrics record
  await prisma.portfolioMetric.create({
    data: {
      portfolioId: portfolio.id,
    },
  });

  logger.info({ portfolioId: portfolio.id, name: portfolio.name }, 'Portfolio created');

  return portfolio;
}

// ============================================================================
// Balance & Snapshot Management
// ============================================================================

/**
 * Update portfolio balance based on open and closed positions
 */
export async function updatePortfolioBalance(portfolioId: string): Promise<{
  balance: number;
  unrealizedPnl: number;
  realizedPnl: number;
}> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
  });

  if (!portfolio) {
    throw new Error(`Portfolio ${portfolioId} not found`);
  }

  // Get all closed positions to calculate realized PnL
  const closedPositions = await prisma.simulatedPosition.findMany({
    where: { portfolioId, status: 'CLOSED' },
    select: { pnlUSDT: true },
  });

  const realizedPnl = closedPositions.reduce(
    (sum, pos) => sum + (pos.pnlUSDT ?? 0),
    0
  );

  // Get all open positions to calculate unrealized PnL
  const openPositions = await prisma.simulatedPosition.findMany({
    where: { portfolioId, status: 'OPEN' },
    select: {
      symbol: true,
      direction: true,
      entryPrice: true,
      leverage: true,
      marginNotional: true,
      positionNotional: true,
    },
  });

  // Calculate unrealized PnL (simplified - uses last known price)
  let unrealizedPnl = 0;
  for (const pos of openPositions) {
    // Get current price (simplified - reuses logic from positionMonitor)
    const latestSnapshot = await prisma.positionSnapshot.findFirst({
      where: { symbol: pos.symbol, platform: 'binance' },
      orderBy: { fetchedAt: 'desc' },
      select: { markPrice: true, entryPrice: true },
    });

    const currentPrice = latestSnapshot?.markPrice || latestSnapshot?.entryPrice || pos.entryPrice;

    const rawMove =
      pos.direction === 'LONG'
        ? (currentPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - currentPrice) / pos.entryPrice;

    unrealizedPnl += pos.positionNotional * rawMove;
  }

  const currentBalance = portfolio.initialBalance + realizedPnl;

  // Update portfolio
  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { currentBalance: round4(currentBalance) },
  });

  return {
    balance: round4(currentBalance),
    unrealizedPnl: round4(unrealizedPnl),
    realizedPnl: round4(realizedPnl),
  };
}

/**
 * Create a portfolio snapshot for equity curve tracking
 */
export async function createPortfolioSnapshot(portfolioId: string) {
  const balanceData = await updatePortfolioBalance(portfolioId);

  const openPositionsCount = await prisma.simulatedPosition.count({
    where: { portfolioId, status: 'OPEN' },
  });

  const totalPnl = balanceData.realizedPnl + balanceData.unrealizedPnl;
  const totalValue = balanceData.balance + balanceData.unrealizedPnl;

  const snapshot = await prisma.portfolioSnapshot.create({
    data: {
      portfolioId,
      balance: balanceData.balance,
      unrealizedPnl: balanceData.unrealizedPnl,
      realizedPnl: balanceData.realizedPnl,
      totalPnl: round4(totalPnl),
      openPositions: openPositionsCount,
      totalValue: round4(totalValue),
    },
  });

  return snapshot;
}

// ============================================================================
// Portfolio Metrics Calculation
// ============================================================================

/**
 * Update portfolio metrics based on closed positions
 */
export async function updatePortfolioMetrics(portfolioId: string) {
  const closedPositions = await prisma.simulatedPosition.findMany({
    where: { portfolioId, status: 'CLOSED' },
    orderBy: { closedAt: 'desc' },
    select: {
      pnlUSDT: true,
      totalCommissionUSDT: true,
      slippageBps: true,
      closedAt: true,
    },
  });

  const totalTrades = closedPositions.length;

  if (totalTrades === 0) {
    // No trades yet, keep defaults
    return prisma.portfolioMetric.upsert({
      where: { portfolioId },
      update: { updatedAt: new Date() },
      create: { portfolioId },
    });
  }

  // Separate winners and losers
  const winners = closedPositions.filter((p) => (p.pnlUSDT ?? 0) > 0);
  const losers = closedPositions.filter((p) => (p.pnlUSDT ?? 0) < 0);

  const winningTrades = winners.length;
  const losingTrades = losers.length;
  const winRate = winningTrades / totalTrades;

  const avgWin =
    winners.length > 0
      ? winners.reduce((sum, p) => sum + (p.pnlUSDT ?? 0), 0) / winners.length
      : 0;

  const avgLoss =
    losers.length > 0
      ? Math.abs(losers.reduce((sum, p) => sum + (p.pnlUSDT ?? 0), 0) / losers.length)
      : 0;

  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

  // Calculate max consecutive wins/losses
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const pos of closedPositions) {
    if ((pos.pnlUSDT ?? 0) > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      maxConsecWins = Math.max(maxConsecWins, currentWinStreak);
    } else if ((pos.pnlUSDT ?? 0) < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      maxConsecLosses = Math.max(maxConsecLosses, currentLossStreak);
    }
  }

  // Calculate execution quality metrics
  const avgSlippageBps =
    closedPositions.reduce((sum, p) => sum + (p.slippageBps ?? 0), 0) / totalTrades;

  const totalCommission = closedPositions.reduce(
    (sum, p) => sum + (p.totalCommissionUSDT ?? 0),
    0
  );

  // Calculate max drawdown (simplified - based on cumulative PnL)
  let cumulativePnl = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const pos of closedPositions.reverse()) {
    cumulativePnl += pos.pnlUSDT ?? 0;
    peak = Math.max(peak, cumulativePnl);
    const drawdown = peak - cumulativePnl;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Calculate as percentage of peak
  const maxDrawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

  // Update metrics
  const metrics = await prisma.portfolioMetric.upsert({
    where: { portfolioId },
    update: {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: round4(winRate),
      avgWin: round4(avgWin),
      avgLoss: round4(avgLoss),
      profitFactor: round4(profitFactor),
      maxDrawdown: round4(maxDrawdownPct),
      maxConsecWins,
      maxConsecLosses,
      avgSlippageBps: round4(avgSlippageBps),
      totalCommission: round4(totalCommission),
      updatedAt: new Date(),
    },
    create: {
      portfolioId,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: round4(winRate),
      avgWin: round4(avgWin),
      avgLoss: round4(avgLoss),
      profitFactor: round4(profitFactor),
      maxDrawdown: round4(maxDrawdownPct),
      maxConsecWins,
      maxConsecLosses,
      avgSlippageBps: round4(avgSlippageBps),
      totalCommission: round4(totalCommission),
    },
  });

  logger.debug({ portfolioId, metrics }, 'Portfolio metrics updated');

  return metrics;
}

/**
 * Get comprehensive portfolio performance data
 */
export async function getPortfolioPerformance(portfolioId: string) {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
  });

  if (!portfolio) {
    throw new Error(`Portfolio ${portfolioId} not found`);
  }

  const metrics = await prisma.portfolioMetric.findUnique({
    where: { portfolioId },
  });

  const equityCurve = await prisma.portfolioSnapshot.findMany({
    where: { portfolioId },
    orderBy: { snapshotAt: 'asc' },
    take: 500,
  });

  const currentPositions = await prisma.simulatedPosition.findMany({
    where: { portfolioId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });

  return {
    portfolio,
    metrics,
    equityCurve,
    currentPositions,
  };
}
