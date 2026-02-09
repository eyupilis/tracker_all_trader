/**
 * Risk Calculator Service (Sprint 1)
 * Pure computation functions for position sizing and risk assessment
 * Following the pattern of traderWeight.ts (pure functions, no DB access)
 */

// ============================================================================
// Utility Functions
// ============================================================================

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// Kelly Criterion Position Sizing
// ============================================================================

export interface KellySizeInput {
  traderWinRate: number; // from TraderScore (0.0-1.0)
  avgRiskReward: number; // default 2.0
  portfolioBalance: number;
  kellyFraction: number; // 0.25 = quarter Kelly
  minSampleSize: number; // min trades required
}

export interface KellySizeResult {
  marginNotional: number;
  kelly: number; // full Kelly percentage
  appliedFraction: number;
  reason?: string;
}

export function computeKellySize(params: KellySizeInput): KellySizeResult {
  const { traderWinRate, avgRiskReward, portfolioBalance, kellyFraction, minSampleSize } = params;

  // Validate inputs
  if (portfolioBalance <= 0) {
    return {
      marginNotional: 0,
      kelly: 0,
      appliedFraction: 0,
      reason: 'Portfolio balance must be positive',
    };
  }

  if (traderWinRate < 0.3) {
    return {
      marginNotional: 0,
      kelly: 0,
      appliedFraction: 0,
      reason: `Win rate too low (${(traderWinRate * 100).toFixed(1)}%), Kelly not applicable`,
    };
  }

  // Kelly formula: f* = (bp - q) / b
  // where: b = reward/risk ratio, p = win rate, q = 1 - p
  const p = traderWinRate;
  const q = 1 - p;
  const b = avgRiskReward;

  const kelly = (b * p - q) / b;

  // Kelly can be negative if edge is negative
  if (kelly <= 0) {
    return {
      marginNotional: 0,
      kelly: round4(kelly),
      appliedFraction: 0,
      reason: `Negative Kelly (${round4(kelly)}), no edge detected`,
    };
  }

  // Apply Kelly fraction (typically 0.25 for quarter-Kelly)
  const appliedFraction = clamp(kelly * kellyFraction, 0, 0.25); // Cap at 25% of portfolio

  const marginNotional = round4(portfolioBalance * appliedFraction);

  return {
    marginNotional,
    kelly: round4(kelly),
    appliedFraction: round4(appliedFraction),
  };
}

// ============================================================================
// Risk-Based Position Sizing
// ============================================================================

export interface RiskBasedSizeInput {
  portfolioBalance: number;
  riskPercentage: number; // e.g., 2.0 = 2%
  entryPrice: number;
  stopLossPrice: number;
  leverage: number;
}

export interface RiskBasedSizeResult {
  marginNotional: number;
  positionNotional: number;
  maxLoss: number;
  stopLossDistance: number; // as percentage
}

export function computeRiskBasedSize(params: RiskBasedSizeInput): RiskBasedSizeResult {
  const { portfolioBalance, riskPercentage, entryPrice, stopLossPrice, leverage } = params;

  // Calculate stop loss distance as percentage
  const stopLossDistance = Math.abs((stopLossPrice - entryPrice) / entryPrice);

  // Risk amount in USDT
  const riskAmount = portfolioBalance * (riskPercentage / 100);

  // Position notional to achieve desired risk
  // riskAmount = positionNotional * stopLossDistance
  const positionNotional = riskAmount / stopLossDistance;

  // Margin required
  const marginNotional = positionNotional / Math.max(leverage, 1);

  return {
    marginNotional: round4(marginNotional),
    positionNotional: round4(positionNotional),
    maxLoss: round4(riskAmount),
    stopLossDistance: round4(stopLossDistance * 100), // as percentage
  };
}

// ============================================================================
// Stop Loss Calculator
// ============================================================================

export interface StopLossInput {
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
  fixedPct?: number; // percentage from entry
  riskAmount?: number; // USDT to risk
  positionNotional?: number; // required if riskAmount provided
}

export interface StopLossResult {
  stopLossPrice: number;
  potentialLossUSDT: number;
  stopLossDistance: number; // as percentage
}

export function computeStopLoss(params: StopLossInput): StopLossResult {
  const { entryPrice, direction, fixedPct, riskAmount, positionNotional } = params;

  let stopLossPrice: number;
  let stopLossDistance: number;

  if (fixedPct !== undefined) {
    // Fixed percentage from entry
    stopLossDistance = fixedPct / 100;
    if (direction === 'LONG') {
      stopLossPrice = entryPrice * (1 - stopLossDistance);
    } else {
      stopLossPrice = entryPrice * (1 + stopLossDistance);
    }
  } else if (riskAmount !== undefined && positionNotional !== undefined) {
    // Calculate SL based on risk amount
    stopLossDistance = riskAmount / positionNotional;
    if (direction === 'LONG') {
      stopLossPrice = entryPrice * (1 - stopLossDistance);
    } else {
      stopLossPrice = entryPrice * (1 + stopLossDistance);
    }
  } else {
    // Default: 2% stop loss
    stopLossDistance = 0.02;
    if (direction === 'LONG') {
      stopLossPrice = entryPrice * 0.98;
    } else {
      stopLossPrice = entryPrice * 1.02;
    }
  }

  const potentialLossUSDT = positionNotional
    ? round4(positionNotional * stopLossDistance)
    : 0;

  return {
    stopLossPrice: round4(stopLossPrice),
    potentialLossUSDT,
    stopLossDistance: round4(stopLossDistance * 100), // as percentage
  };
}

// ============================================================================
// Take Profit Calculator
// ============================================================================

export interface TakeProfitInput {
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
  riskRewardRatio: number; // e.g., 2.0 = 2:1 R/R
  stopLossPrice: number;
  positionNotional?: number;
}

export interface TakeProfitResult {
  takeProfitPrice: number;
  potentialGainUSDT: number;
  takeProfitDistance: number; // as percentage
}

export function computeTakeProfit(params: TakeProfitInput): TakeProfitResult {
  const { entryPrice, direction, riskRewardRatio, stopLossPrice, positionNotional } = params;

  // Calculate stop loss distance
  const stopLossDistance = Math.abs((stopLossPrice - entryPrice) / entryPrice);

  // Take profit distance = stopLossDistance * riskRewardRatio
  const takeProfitDistance = stopLossDistance * riskRewardRatio;

  let takeProfitPrice: number;
  if (direction === 'LONG') {
    takeProfitPrice = entryPrice * (1 + takeProfitDistance);
  } else {
    takeProfitPrice = entryPrice * (1 - takeProfitDistance);
  }

  const potentialGainUSDT = positionNotional
    ? round4(positionNotional * takeProfitDistance)
    : 0;

  return {
    takeProfitPrice: round4(takeProfitPrice),
    potentialGainUSDT,
    takeProfitDistance: round4(takeProfitDistance * 100), // as percentage
  };
}

// ============================================================================
// Trailing Stop Logic
// ============================================================================

export interface TrailingStopInput {
  currentPrice: number;
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
  trailingPct: number; // e.g., 2.0 = 2%
  currentTrigger: number | null; // highest/lowest price reached
}

export interface TrailingStopResult {
  newTrigger: number;
  newStopPrice: number;
  shouldUpdate: boolean;
  isTriggered: boolean;
}

export function updateTrailingStop(params: TrailingStopInput): TrailingStopResult {
  const { currentPrice, direction, trailingPct, currentTrigger } = params;

  const trailingDistance = trailingPct / 100;

  if (direction === 'LONG') {
    // For LONG: track highest price
    const highestPrice = currentTrigger === null
      ? currentPrice
      : Math.max(currentTrigger, currentPrice);

    const newStopPrice = highestPrice * (1 - trailingDistance);
    const shouldUpdate = currentTrigger === null || currentPrice > currentTrigger;
    const isTriggered = currentPrice <= newStopPrice;

    return {
      newTrigger: round4(highestPrice),
      newStopPrice: round4(newStopPrice),
      shouldUpdate,
      isTriggered,
    };
  } else {
    // For SHORT: track lowest price
    const lowestPrice = currentTrigger === null
      ? currentPrice
      : Math.min(currentTrigger, currentPrice);

    const newStopPrice = lowestPrice * (1 + trailingDistance);
    const shouldUpdate = currentTrigger === null || currentPrice < currentTrigger;
    const isTriggered = currentPrice >= newStopPrice;

    return {
      newTrigger: round4(lowestPrice),
      newStopPrice: round4(newStopPrice),
      shouldUpdate,
      isTriggered,
    };
  }
}

// ============================================================================
// Portfolio Risk Validator
// ============================================================================

export interface PortfolioRiskInput {
  currentBalance: number;
  openPositions: Array<{ marginNotional: number; leverage: number }>;
  newPosition: { marginNotional: number; leverage: number };
  maxRiskPct: number; // max portfolio exposure %
  maxOpenPositions: number;
}

export interface PortfolioRiskResult {
  allowed: boolean;
  reason?: string;
  currentRiskPct: number;
  newRiskPct: number;
  currentOpenPositions: number;
}

export function checkPortfolioRisk(params: PortfolioRiskInput): PortfolioRiskResult {
  const {
    currentBalance,
    openPositions,
    newPosition,
    maxRiskPct,
    maxOpenPositions,
  } = params;

  // Check max open positions
  if (openPositions.length >= maxOpenPositions) {
    return {
      allowed: false,
      reason: `Maximum open positions reached (${maxOpenPositions})`,
      currentRiskPct: 0,
      newRiskPct: 0,
      currentOpenPositions: openPositions.length,
    };
  }

  // Calculate current risk exposure (margin / balance)
  const currentMarginUsed = openPositions.reduce(
    (sum, pos) => sum + pos.marginNotional,
    0
  );
  const currentRiskPct = (currentMarginUsed / currentBalance) * 100;

  // Calculate new risk exposure
  const newMarginUsed = currentMarginUsed + newPosition.marginNotional;
  const newRiskPct = (newMarginUsed / currentBalance) * 100;

  if (newRiskPct > maxRiskPct) {
    return {
      allowed: false,
      reason: `Exceeds max portfolio risk (${round4(newRiskPct)}% > ${maxRiskPct}%)`,
      currentRiskPct: round4(currentRiskPct),
      newRiskPct: round4(newRiskPct),
      currentOpenPositions: openPositions.length,
    };
  }

  return {
    allowed: true,
    currentRiskPct: round4(currentRiskPct),
    newRiskPct: round4(newRiskPct),
    currentOpenPositions: openPositions.length,
  };
}
