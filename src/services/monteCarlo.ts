/**
 * Monte Carlo Simulation Service (Sprint 2)
 * Bootstrap resampling for confidence intervals and probability of ruin
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

export interface MonteCarloInput {
  trades: Array<{ pnl: number; roi: number }>;
  initialBalance: number;
  numSimulations: number; // Default 1000
  maxPositions?: number; // Optional: limit number of trades per simulation
}

export interface MonteCarloResult {
  simulations: number[]; // Final equity for each run
  mean: number;
  median: number;
  stdDev: number;
  confidence95Low: number;
  confidence95High: number;
  probabilityOfRuin: number; // % of runs ending below initial balance
  worstCase: number;
  bestCase: number;
}

// ============================================================================
// Monte Carlo Simulation via Bootstrap Resampling
// ============================================================================

/**
 * Run Monte Carlo simulation via bootstrap resampling
 *
 * Bootstrap methodology:
 * - Randomly samples trades WITH replacement
 * - Generates alternate trade sequences to model uncertainty
 * - No assumptions about return distributions (non-parametric)
 * - Efficient for small to medium sample sizes (< 1000 trades)
 *
 * @param params - Monte Carlo simulation parameters
 * @returns Aggregated statistics from all simulation runs
 */
export function runMonteCarloSimulation(
  params: MonteCarloInput
): MonteCarloResult {
  const {
    trades,
    initialBalance,
    numSimulations = 1000,
    maxPositions,
  } = params;

  // Edge case: no trades
  if (trades.length === 0) {
    return {
      simulations: [],
      mean: initialBalance,
      median: initialBalance,
      stdDev: 0,
      confidence95Low: initialBalance,
      confidence95High: initialBalance,
      probabilityOfRuin: 0,
      worstCase: initialBalance,
      bestCase: initialBalance,
    };
  }

  const results: number[] = [];
  const sampleSize = maxPositions || trades.length;

  // Run simulations
  for (let sim = 0; sim < numSimulations; sim++) {
    let equity = initialBalance;

    // Bootstrap: sample trades WITH replacement
    for (let i = 0; i < sampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * trades.length);
      const randomTrade = trades[randomIndex];

      equity += randomTrade.pnl;

      // Check for ruin (account blown)
      if (equity <= 0) {
        equity = 0;
        break;
      }
    }

    results.push(equity);
  }

  // Sort results for percentile calculations
  results.sort((a, b) => a - b);

  // Calculate statistics
  const mean = results.reduce((sum, v) => sum + v, 0) / results.length;
  const median = results[Math.floor(results.length / 2)];

  const variance =
    results.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
    results.length;
  const stdDev = Math.sqrt(variance);

  // 95% confidence interval (2.5th and 97.5th percentiles)
  const lowerIndex = Math.floor(0.025 * results.length);
  const upperIndex = Math.floor(0.975 * results.length);
  const confidence95Low = results[lowerIndex];
  const confidence95High = results[upperIndex];

  // Probability of ruin (ending below initial balance)
  const ruinedRuns = results.filter((r) => r < initialBalance).length;
  const probabilityOfRuin = ruinedRuns / results.length;

  // Best and worst case scenarios
  const worstCase = results[0];
  const bestCase = results[results.length - 1];

  return {
    simulations: results,
    mean: round4(mean),
    median: round4(median),
    stdDev: round4(stdDev),
    confidence95Low: round4(confidence95Low),
    confidence95High: round4(confidence95High),
    probabilityOfRuin: round4(probabilityOfRuin),
    worstCase: round4(worstCase),
    bestCase: round4(bestCase),
  };
}
