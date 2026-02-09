/**
 * Advanced Metrics Service (Sprint 2)
 * Risk-adjusted performance metrics: Sharpe, Sortino, Calmar, VaR, CVaR
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

export interface TradeResult {
  pnl: number;
  roi: number;
  timestamp: Date;
}

export interface AdvancedMetricsInput {
  trades: TradeResult[];
  initialBalance: number;
  riskFreeRate?: number; // Annual risk-free rate (default 0.02 = 2%)
  tradingDaysPerYear?: number; // Default 365 for crypto
}

export interface AdvancedMetricsResult {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  var95: number; // 95% Value at Risk
  cvar95: number; // 95% Conditional VaR (Expected Shortfall)
  maxDrawdown: number;
  maxDrawdownDuration: number; // days
  recoveryFactor: number;
  profitFactor: number;
  avgReturn: number;
  stdDev: number;
  downstdDev: number; // downside deviation for Sortino
}

// ============================================================================
// Sharpe Ratio Calculation
// ============================================================================

/**
 * Compute Sharpe Ratio: (R_p - R_f) / σ_p
 * Measures excess return per unit of total risk
 */
export function computeSharpeRatio(params: {
  returns: number[];
  riskFreeRate: number;
}): number {
  const { returns, riskFreeRate } = params;

  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
    returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const excessReturn = avgReturn - riskFreeRate;
  return excessReturn / stdDev;
}

// ============================================================================
// Sortino Ratio Calculation
// ============================================================================

/**
 * Compute Sortino Ratio: (R_p - R_f) / σ_downside
 * Only penalizes downside volatility (negative returns)
 * Better for strategies with asymmetric return distribution
 */
export function computeSortinoRatio(params: {
  returns: number[];
  riskFreeRate: number;
}): number {
  const { returns, riskFreeRate } = params;

  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Only consider negative returns for downside deviation
  const downside = returns.filter((r) => r < 0);

  if (downside.length === 0) return 0;

  const downsideVariance =
    downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downside.length;
  const downsideStdDev = Math.sqrt(downsideVariance);

  if (downsideStdDev === 0) return 0;

  const excessReturn = avgReturn - riskFreeRate;
  return excessReturn / downsideStdDev;
}

// ============================================================================
// Calmar Ratio Calculation
// ============================================================================

/**
 * Compute Calmar Ratio: CAGR / Max Drawdown
 * Measures return per unit of maximum drawdown risk
 */
export function computeCalmarRatio(params: {
  totalReturn: number;
  maxDrawdown: number;
  years: number;
}): number {
  const { totalReturn, maxDrawdown, years } = params;

  if (maxDrawdown === 0 || years === 0) return 0;

  // Calculate CAGR (Compound Annual Growth Rate)
  const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;

  return cagr / maxDrawdown;
}

// ============================================================================
// Value at Risk (VaR) Calculation
// ============================================================================

/**
 * Compute Value at Risk (VaR) at specified confidence level
 * Returns the percentile of losses (e.g., 5th percentile for 95% confidence)
 * VaR represents the maximum loss expected at the given confidence level
 */
export function computeVaR(params: {
  returns: number[];
  confidenceLevel: number; // 0.95 for 95%
}): number {
  const { returns, confidenceLevel } = params;

  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);

  // VaR is expressed as positive number (absolute value of loss)
  return Math.abs(sorted[index]);
}

// ============================================================================
// Conditional Value at Risk (CVaR) Calculation
// ============================================================================

/**
 * Compute Conditional VaR (CVaR / Expected Shortfall)
 * Average of all losses beyond the VaR threshold
 * More conservative than VaR as it considers tail risk
 */
export function computeCVaR(params: {
  returns: number[];
  confidenceLevel: number;
}): number {
  const { returns, confidenceLevel } = params;

  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const varIndex = Math.floor((1 - confidenceLevel) * sorted.length);

  // Take all losses beyond VaR threshold
  const tailLosses = sorted.slice(0, varIndex + 1);

  if (tailLosses.length === 0) return 0;

  // Average of tail losses (expressed as positive number)
  const avgTailLoss =
    tailLosses.reduce((sum, r) => sum + r, 0) / tailLosses.length;
  return Math.abs(avgTailLoss);
}

// ============================================================================
// Main Advanced Metrics Computation
// ============================================================================

/**
 * Compute all advanced metrics in a single pass
 */
export function computeAdvancedMetrics(
  params: AdvancedMetricsInput
): AdvancedMetricsResult {
  const {
    trades,
    initialBalance,
    riskFreeRate = 0.02,
    tradingDaysPerYear = 365,
  } = params;

  // Handle edge case: no trades
  if (trades.length === 0) {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      var95: 0,
      cvar95: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      recoveryFactor: 0,
      profitFactor: 0,
      avgReturn: 0,
      stdDev: 0,
      downstdDev: 0,
    };
  }

  // Build equity curve
  const equity: number[] = [initialBalance];
  for (const trade of trades) {
    equity.push(equity[equity.length - 1] + trade.pnl);
  }

  // Calculate returns (percentage change)
  const returns = equity
    .slice(1)
    .map((value, i) => (value - equity[i]) / equity[i]);

  // Drawdown analysis
  let peak = equity[0];
  let maxDrawdown = 0;
  let maxDrawdownDuration = 0;
  let currentDrawdownStart = 0;
  const drawdowns: number[] = [];

  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) {
      peak = equity[i];
      currentDrawdownStart = i;
    }
    const drawdown = peak > 0 ? (peak - equity[i]) / peak : 0;
    drawdowns.push(drawdown);
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    if (drawdown > 0) {
      maxDrawdownDuration = Math.max(
        maxDrawdownDuration,
        i - currentDrawdownStart
      );
    }
  }

  // Risk-free rate adjusted for trading frequency
  const dailyRiskFreeRate = riskFreeRate / tradingDaysPerYear;

  // Compute risk-adjusted ratios
  const sharpeRatio = computeSharpeRatio({
    returns,
    riskFreeRate: dailyRiskFreeRate,
  });

  const sortinoRatio = computeSortinoRatio({
    returns,
    riskFreeRate: dailyRiskFreeRate,
  });

  // Calculate time span for Calmar Ratio
  const totalReturn =
    (equity[equity.length - 1] - initialBalance) / initialBalance;
  const years =
    trades.length > 0
      ? (trades[trades.length - 1].timestamp.getTime() -
          trades[0].timestamp.getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
      : 1;
  const calmarRatio = computeCalmarRatio({ totalReturn, maxDrawdown, years });

  // Compute VaR and CVaR at 95% confidence
  const var95 = computeVaR({ returns, confidenceLevel: 0.95 });
  const cvar95 = computeCVaR({ returns, confidenceLevel: 0.95 });

  // Profit factor calculation
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

  // Recovery factor: Net PnL / Max Drawdown (in dollars)
  const netPnl = equity[equity.length - 1] - initialBalance;
  const maxDrawdownDollars = maxDrawdown * initialBalance;
  const recoveryFactor =
    maxDrawdownDollars > 0 ? netPnl / maxDrawdownDollars : 0;

  // Return statistics
  const avgReturn =
    returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
    returns.length;
  const stdDev = Math.sqrt(variance);

  // Downside deviation (for Sortino)
  const downside = returns.filter((r) => r < 0);
  const downsideVariance =
    downside.length > 0
      ? downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downside.length
      : 0;
  const downstdDev = Math.sqrt(downsideVariance);

  return {
    sharpeRatio: round4(sharpeRatio),
    sortinoRatio: round4(sortinoRatio),
    calmarRatio: round4(calmarRatio),
    var95: round4(var95),
    cvar95: round4(cvar95),
    maxDrawdown: round4(maxDrawdown),
    maxDrawdownDuration,
    recoveryFactor: round4(recoveryFactor),
    profitFactor: round4(profitFactor),
    avgReturn: round4(avgReturn),
    stdDev: round4(stdDev),
    downstdDev: round4(downstdDev),
  };
}
