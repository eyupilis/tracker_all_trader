/**
 * Walk-Forward Analysis Service (Sprint 2)
 * Rolling window in-sample vs out-of-sample validation
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

export interface WalkForwardInput {
  trades: Array<{ pnl: number; roi: number; timestamp: Date }>;
  inSampleRatio: number; // 0.7 = 70% in-sample, 30% out-of-sample
  numWindows: number; // Default 5
}

export interface WindowMetrics {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalTrades: number;
}

export interface WalkForwardWindow {
  windowIndex: number;
  inSample: WindowMetrics;
  outSample: WindowMetrics;
  degradation: number; // (outSample - inSample) / inSample for winRate
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  avgInSampleWinRate: number;
  avgOutSampleWinRate: number;
  correlation: number; // Correlation between in-sample and out-of-sample performance
  overfitScore: number; // 0-100: higher = more overfit (poor out-of-sample)
}

// ============================================================================
// Window Metrics Calculation
// ============================================================================

/**
 * Calculate performance metrics for a window of trades
 */
function calculateWindowMetrics(
  trades: Array<{ pnl: number }>
): WindowMetrics {
  if (trades.length === 0) {
    return {
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      totalTrades: 0,
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);

  const winRate = trades.length > 0 ? wins.length / trades.length : 0;

  const avgWin =
    wins.length > 0
      ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length
      : 0;

  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length)
      : 0;

  const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

  return {
    winRate: round4(winRate),
    avgWin: round4(avgWin),
    avgLoss: round4(avgLoss),
    profitFactor: round4(profitFactor),
    totalTrades: trades.length,
  };
}

// ============================================================================
// Correlation Calculation
// ============================================================================

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  const meanX = x.reduce((sum, v) => sum + v, 0) / n;
  const meanY = y.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom > 0 ? numerator / denom : 0;
}

// ============================================================================
// Walk-Forward Analysis
// ============================================================================

/**
 * Perform walk-forward analysis with rolling windows
 *
 * Walk-forward methodology:
 * - Splits data into multiple rolling windows
 * - Each window divided into in-sample (training) and out-of-sample (testing)
 * - Measures performance degradation from in-sample to out-of-sample
 * - High correlation + low degradation = stable strategy
 * - Low correlation + high degradation = overfitting
 *
 * @param params - Walk-forward analysis parameters
 * @returns Aggregate statistics across all windows
 */
export function runWalkForwardAnalysis(
  params: WalkForwardInput
): WalkForwardResult {
  const { trades, inSampleRatio = 0.7, numWindows = 5 } = params;

  // Edge case: insufficient trades
  if (trades.length < numWindows * 10) {
    throw new Error(
      `Insufficient trades for walk-forward analysis. Need at least ${
        numWindows * 10
      } trades, got ${trades.length}`
    );
  }

  // Sort trades by timestamp
  const sortedTrades = [...trades].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const windows: WalkForwardWindow[] = [];
  const windowSize = Math.floor(sortedTrades.length / numWindows);
  const inSampleSize = Math.floor(windowSize * inSampleRatio);

  // Create rolling windows
  for (let i = 0; i < numWindows; i++) {
    const start = i * windowSize;
    const inSampleEnd = start + inSampleSize;
    const outSampleEnd = Math.min(start + windowSize, sortedTrades.length);

    const inSampleTrades = sortedTrades.slice(start, inSampleEnd);
    const outSampleTrades = sortedTrades.slice(inSampleEnd, outSampleEnd);

    // Skip windows with insufficient out-of-sample data
    if (outSampleTrades.length < 5) continue;

    // Calculate metrics for both samples
    const inSample = calculateWindowMetrics(inSampleTrades);
    const outSample = calculateWindowMetrics(outSampleTrades);

    // Calculate degradation (focus on win rate)
    const degradation =
      inSample.winRate > 0
        ? (outSample.winRate - inSample.winRate) / inSample.winRate
        : 0;

    windows.push({
      windowIndex: i + 1,
      inSample,
      outSample,
      degradation: round4(degradation),
    });
  }

  // Calculate aggregate statistics
  const avgInSampleWinRate =
    windows.reduce((sum, w) => sum + w.inSample.winRate, 0) / windows.length;

  const avgOutSampleWinRate =
    windows.reduce((sum, w) => sum + w.outSample.winRate, 0) / windows.length;

  // Correlation between in-sample and out-of-sample win rates
  const correlation = calculateCorrelation(
    windows.map((w) => w.inSample.winRate),
    windows.map((w) => w.outSample.winRate)
  );

  // Overfit score: higher when out-of-sample significantly underperforms in-sample
  // Negative degradation = out-of-sample worse than in-sample
  const avgDegradation =
    windows.reduce((sum, w) => sum + w.degradation, 0) / windows.length;

  // Convert to 0-100 scale (higher = more overfit)
  // -50% degradation = 50 overfit score, -100% = 100, 0% = 0
  const overfitScore = Math.max(0, Math.min(100, -avgDegradation * 100));

  return {
    windows,
    avgInSampleWinRate: round4(avgInSampleWinRate),
    avgOutSampleWinRate: round4(avgOutSampleWinRate),
    correlation: round4(correlation),
    overfitScore: round4(overfitScore),
  };
}
