/**
 * Trader Metrics Service
 *
 * Extracted from signals.ts route handler (lines 407-634).
 * Computes qualityScore, winRate, confidence, and behavioral metrics
 * from a raw ingest payload.
 *
 * Used by:
 *   - GET /signals/metrics/:leadId (route handler)
 *   - traderWeight.ts (consensus weight pipeline)
 */

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface TraderMetricsResult {
  nickname: string;
  qualityScore: number;       // 0-100
  confidence: 'low' | 'medium' | 'high';
  winRate: number | null;     // 0.0-1.0, null = insufficient data
  sampleSize: number;         // closed trades in 7d window
  positionsVisible: boolean;
  avgLeverage: number | null;
  totalRealizedPnl: number;
  avgPnlPerTrade: number;
  scoreBreakdown: Record<string, number>;

  // Detailed sub-results for the full /signals/metrics response
  tradeCounts: {
    closedTrades7d: number;
    closedTrades30d: number;
    orders7d: number;
    orders30d: number;
    closesPerDay7d: number;
    ordersPerDay7d: number;
  };
  winLoss: {
    wins: number;
    losses: number;
    breakevens: number;
    winRate: number | null; // percentage (0-100), null if insufficient
    winRateNote?: string;
  };
  streaks: {
    maxConsecutiveLosses: number;
    maxConsecutiveWins: number;
    currentStreak: string;
  };
  leverage: {
    avgLeverage: number | null;
    isEstimated: boolean;
    note?: string;
  };
  dataAvailability: {
    positionsVisible: boolean;
    ordersCount: number;
    roiDataPoints: number;
  };
}

// ────────────────────────────────────────────────────────────
// Main computation function
// ────────────────────────────────────────────────────────────

/**
 * Compute all trader metrics from a raw ingest payload.
 * This is a pure function that takes a payload and returns metrics.
 */
export function computeTraderMetrics(payload: unknown): TraderMetricsResult {
  const p = payload as Record<string, any>;
  const orders: any[] = p?.orderHistory?.allOrders || [];
  const positions: any[] = p?.activePositions || [];
  const portfolio: Record<string, any> = p?.portfolioDetail || {};
  const roiSeries: any[] = p?.roiSeries || [];

  const nickname = portfolio.nickname || 'Unknown';

  // Time ranges
  const now = Date.now();
  const day7 = now - 7 * 24 * 60 * 60 * 1000;
  const day30 = now - 30 * 24 * 60 * 60 * 1000;

  // ═══════════════════════════════════════════════════════════
  // TRADES / CLOSES CALCULATION
  // ═══════════════════════════════════════════════════════════

  // Only CLOSE events count as "trades" for win rate
  const closingTrades = orders.filter(
    (o: any) =>
      (o.side === 'SELL' && o.positionSide === 'LONG') ||
      (o.side === 'BUY' && o.positionSide === 'SHORT'),
  );

  const closingTrades7d = closingTrades.filter((o: any) => o.orderTime >= day7);
  const closingTrades30d = closingTrades.filter((o: any) => o.orderTime >= day30);

  const orders7d = orders.filter((o: any) => o.orderTime >= day7);
  const orders30d = orders.filter((o: any) => o.orderTime >= day30);

  // ═══════════════════════════════════════════════════════════
  // WIN RATE with proper categorization
  // ═══════════════════════════════════════════════════════════

  const wins = closingTrades.filter((o: any) => o.totalPnl > 0);
  const losses = closingTrades.filter((o: any) => o.totalPnl < 0);
  const breakevens = closingTrades.filter(
    (o: any) => o.totalPnl === 0 || o.totalPnl === null,
  );

  const tradesWithResult = wins.length + losses.length;
  const winRate = tradesWithResult > 0 ? wins.length / tradesWithResult : null;

  // ═══════════════════════════════════════════════════════════
  // CONSECUTIVE LOSSES / WINS
  // ═══════════════════════════════════════════════════════════

  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  let consecutiveWins = 0;
  let maxConsecutiveWins = 0;

  const sortedCloses = [...closingTrades].sort(
    (a: any, b: any) => a.orderTime - b.orderTime,
  );

  for (const order of sortedCloses) {
    if (order.totalPnl < 0) {
      consecutiveLosses++;
      consecutiveWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
    } else if (order.totalPnl > 0) {
      consecutiveWins++;
      consecutiveLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // REALIZED PNL
  // ═══════════════════════════════════════════════════════════

  const totalRealizedPnl = closingTrades.reduce(
    (sum: number, o: any) => sum + (o.totalPnl || 0),
    0,
  );
  const avgPnlPerTrade =
    tradesWithResult > 0 ? totalRealizedPnl / tradesWithResult : 0;

  // ═══════════════════════════════════════════════════════════
  // LEVERAGE
  // ═══════════════════════════════════════════════════════════

  const positionsVisible = positions.length > 0 && positions[0]?.symbol;
  const avgLeverage = positionsVisible
    ? positions.reduce((sum: number, p: any) => sum + (p.leverage || 0), 0) /
      positions.length
    : null;

  // ═══════════════════════════════════════════════════════════
  // QUALITY SCORE with BREAKDOWN
  // ═══════════════════════════════════════════════════════════

  const scoreBreakdown: Record<string, number> = { base: 50 };
  let qualityScore = 50;

  // Win rate contribution (max +20)
  if (winRate !== null) {
    const winRateContrib = Math.round(winRate * 20);
    scoreBreakdown.winRate = winRateContrib;
    qualityScore += winRateContrib;
  }

  // Sharpe ratio (max +15)
  const sharpe = parseFloat(portfolio.sharpRatio || '0');
  if (sharpe > 0) {
    const sharpeContrib = Math.round(Math.min(sharpe, 3) * 5);
    scoreBreakdown.sharpeRatio = sharpeContrib;
    qualityScore += sharpeContrib;
  }

  // ROI contribution (max ±15)
  if (roiSeries && roiSeries.length >= 2) {
    const firstRoi = roiSeries[0]?.value || 0;
    const lastRoi = roiSeries[roiSeries.length - 1]?.value || 0;
    const roiChange = lastRoi - firstRoi;
    const roiContrib = Math.min(Math.max(Math.round(roiChange / 2), -15), 15);
    scoreBreakdown.roi30d = roiContrib;
    qualityScore += roiContrib;
  }

  // Leverage penalty (only if visible)
  if (avgLeverage !== null) {
    if (avgLeverage > 50) {
      scoreBreakdown.highLeverage = -10;
      qualityScore -= 10;
    } else if (avgLeverage > 30) {
      scoreBreakdown.mediumLeverage = -5;
      qualityScore -= 5;
    } else if (avgLeverage < 20) {
      scoreBreakdown.lowLeverage = 5;
      qualityScore += 5;
    }
  }

  // Consecutive losses penalty (max -15)
  if (maxConsecutiveLosses > 0) {
    const lossesContrib = -Math.min(maxConsecutiveLosses, 3) * 5;
    scoreBreakdown.consecutiveLosses = lossesContrib;
    qualityScore += lossesContrib;
  }

  qualityScore = Math.min(Math.max(Math.round(qualityScore), 0), 100);

  // ═══════════════════════════════════════════════════════════
  // CONFIDENCE LEVEL
  // ═══════════════════════════════════════════════════════════

  const closedSample7d = closingTrades7d.length;

  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (closedSample7d >= 20) confidence = 'high';
  else if (closedSample7d >= 10) confidence = 'medium';

  // ═══════════════════════════════════════════════════════════
  // ASSEMBLE RESULT
  // ═══════════════════════════════════════════════════════════

  return {
    nickname,
    qualityScore,
    confidence,
    winRate,
    sampleSize: closedSample7d,
    positionsVisible: !!positionsVisible,
    avgLeverage,
    totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
    avgPnlPerTrade: Math.round(avgPnlPerTrade * 100) / 100,
    scoreBreakdown,

    tradeCounts: {
      closedTrades7d: closingTrades7d.length,
      closedTrades30d: closingTrades30d.length,
      orders7d: orders7d.length,
      orders30d: orders30d.length,
      closesPerDay7d: Math.round((closingTrades7d.length / 7) * 10) / 10,
      ordersPerDay7d: Math.round((orders7d.length / 7) * 10) / 10,
    },

    winLoss: {
      wins: wins.length,
      losses: losses.length,
      breakevens: breakevens.length,
      winRate: winRate !== null ? Math.round(winRate * 100) : null,
      winRateNote:
        winRate === null ? 'Insufficient closed trades' : undefined,
    },

    streaks: {
      maxConsecutiveLosses,
      maxConsecutiveWins,
      currentStreak:
        consecutiveWins > 0
          ? `+${consecutiveWins} wins`
          : consecutiveLosses > 0
            ? `-${consecutiveLosses} losses`
            : 'neutral',
    },

    leverage: {
      avgLeverage:
        avgLeverage !== null ? Math.round(avgLeverage * 10) / 10 : null,
      isEstimated: !positionsVisible,
      note: positionsVisible
        ? undefined
        : 'Leverage unknown (positions hidden)',
    },

    dataAvailability: {
      positionsVisible: !!positionsVisible,
      ordersCount: orders.length,
      roiDataPoints: roiSeries.length,
    },
  };
}
