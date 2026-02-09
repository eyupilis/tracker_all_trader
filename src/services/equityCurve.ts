/**
 * Equity Curve Service (Sprint 2)
 * Detailed equity tracking with drawdown visualization
 * Pure computation functions following riskCalculator.ts pattern
 */

// ============================================================================
// Utility Functions
// ============================================================================

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  pnl: number;
  cumulativePnl: number;
  drawdown: number; // Current drawdown percentage
  drawdownDuration: number; // Days since last peak
  underwater: boolean; // Is currently in drawdown
}

export interface DrawdownPeriod {
  start: Date;
  end: Date;
  depth: number; // Max drawdown during this period (%)
  duration: number; // Duration in days
}

export interface EquityCurveResult {
  curve: EquityPoint[];
  maxDrawdown: number;
  maxDrawdownDuration: number;
  avgDrawdown: number;
  drawdownPeriods: DrawdownPeriod[];
}

// ============================================================================
// Enhanced Equity Curve Generation
// ============================================================================

/**
 * Generate enhanced equity curve with drawdown tracking
 *
 * Features:
 * - Point-by-point equity tracking
 * - Real-time drawdown calculation at each trade
 * - Drawdown duration tracking
 * - Identification of all drawdown periods (peak → trough → recovery)
 * - Underwater period flagging for visualization
 *
 * @param params - Equity curve generation parameters
 * @returns Detailed equity curve with drawdown analysis
 */
export function generateEquityCurve(params: {
  trades: Array<{ pnl: number; timestamp: Date }>;
  initialBalance: number;
}): EquityCurveResult {
  const { trades, initialBalance } = params;

  // Edge case: no trades
  if (trades.length === 0) {
    return {
      curve: [],
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      avgDrawdown: 0,
      drawdownPeriods: [],
    };
  }

  const curve: EquityPoint[] = [];
  const drawdownPeriods: DrawdownPeriod[] = [];

  let equity = initialBalance;
  let cumulativePnl = 0;
  let peak = initialBalance;
  let peakDate = trades[0].timestamp;
  let currentDrawdownStart: Date | null = null;
  let maxDrawdownDepth = 0;

  // Process each trade
  for (const trade of trades) {
    equity += trade.pnl;
    cumulativePnl += trade.pnl;

    // Calculate current drawdown
    const drawdown = peak > 0 ? (peak - equity) / peak : 0;

    // Calculate drawdown duration in days
    const drawdownDuration = currentDrawdownStart
      ? Math.floor(
          (trade.timestamp.getTime() - peakDate.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : 0;

    // Add point to curve
    curve.push({
      timestamp: trade.timestamp,
      equity: round4(equity),
      pnl: round4(trade.pnl),
      cumulativePnl: round4(cumulativePnl),
      drawdown: round4(drawdown),
      drawdownDuration,
      underwater: drawdown > 0,
    });

    // Track drawdown periods
    if (equity > peak) {
      // New peak - end current drawdown period if any
      if (currentDrawdownStart) {
        drawdownPeriods.push({
          start: currentDrawdownStart,
          end: trade.timestamp,
          depth: round4(maxDrawdownDepth),
          duration: Math.floor(
            (trade.timestamp.getTime() - currentDrawdownStart.getTime()) /
              (24 * 60 * 60 * 1000)
          ),
        });
        currentDrawdownStart = null;
        maxDrawdownDepth = 0;
      }
      peak = equity;
      peakDate = trade.timestamp;
    } else if (drawdown > 0) {
      // In drawdown
      if (!currentDrawdownStart) {
        currentDrawdownStart = peakDate;
      }
      maxDrawdownDepth = Math.max(maxDrawdownDepth, drawdown);
    }
  }

  // Close final drawdown period if still underwater
  if (currentDrawdownStart && trades.length > 0) {
    const lastTrade = trades[trades.length - 1];
    drawdownPeriods.push({
      start: currentDrawdownStart,
      end: lastTrade.timestamp,
      depth: round4(maxDrawdownDepth),
      duration: Math.floor(
        (lastTrade.timestamp.getTime() - currentDrawdownStart.getTime()) /
          (24 * 60 * 60 * 1000)
      ),
    });
  }

  // Calculate statistics
  const maxDrawdown = Math.max(...curve.map((p) => p.drawdown), 0);
  const maxDrawdownDuration = Math.max(
    ...drawdownPeriods.map((d) => d.duration),
    0
  );
  const avgDrawdown =
    drawdownPeriods.length > 0
      ? drawdownPeriods.reduce((sum, d) => sum + d.depth, 0) /
        drawdownPeriods.length
      : 0;

  return {
    curve,
    maxDrawdown: round4(maxDrawdown),
    maxDrawdownDuration,
    avgDrawdown: round4(avgDrawdown),
    drawdownPeriods,
  };
}
