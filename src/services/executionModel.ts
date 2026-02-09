/**
 * Execution Model Service (Sprint 1)
 * Realistic execution modeling: slippage, commission, execution costs
 * Pure computation functions following riskCalculator.ts pattern
 */

// ============================================================================
// Utility Functions
// ============================================================================

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// ============================================================================
// Slippage Modeling
// ============================================================================

export interface SlippageInput {
  basePrice: number;
  direction: 'LONG' | 'SHORT'; // buying or selling
  slippageBps: number; // basis points (10 bps = 0.1%)
  isEntry: boolean; // entries have worse slippage than exits
}

export interface SlippageResult {
  effectivePrice: number;
  slippageUSDT: number; // per 1 unit of asset
  slippagePct: number; // as percentage
}

/**
 * Apply slippage to a price
 * - For LONG entry (buy): price goes UP (worse fill)
 * - For LONG exit (sell): price goes DOWN (worse fill)
 * - For SHORT entry (sell): price goes DOWN (worse fill)
 * - For SHORT exit (buy): price goes UP (worse fill)
 * - Entry slippage is typically higher than exit slippage
 */
export function applySlippage(params: SlippageInput): SlippageResult {
  const { basePrice, direction, slippageBps, isEntry } = params;

  // Convert bps to decimal (10 bps = 0.001 = 0.1%)
  const slippagePct = slippageBps / 10000;

  // Entry slippage is 1.5x worse than exit slippage (assumption)
  const effectiveSlippage = isEntry ? slippagePct * 1.5 : slippagePct;

  let effectivePrice: number;
  let slippageUSDT: number;

  if (direction === 'LONG') {
    if (isEntry) {
      // Buying: price goes up
      effectivePrice = basePrice * (1 + effectiveSlippage);
      slippageUSDT = effectivePrice - basePrice;
    } else {
      // Selling: price goes down
      effectivePrice = basePrice * (1 - effectiveSlippage);
      slippageUSDT = basePrice - effectivePrice;
    }
  } else {
    // SHORT
    if (isEntry) {
      // Selling short: price goes down (worse for us = less proceeds)
      effectivePrice = basePrice * (1 - effectiveSlippage);
      slippageUSDT = basePrice - effectivePrice;
    } else {
      // Buying to cover: price goes up
      effectivePrice = basePrice * (1 + effectiveSlippage);
      slippageUSDT = effectivePrice - basePrice;
    }
  }

  return {
    effectivePrice: round4(effectivePrice),
    slippageUSDT: round4(slippageUSDT),
    slippagePct: round4(effectiveSlippage * 100),
  };
}

// ============================================================================
// Commission Calculation
// ============================================================================

export interface CommissionInput {
  positionNotional: number; // total position size in USDT
  commissionBps: number; // basis points (4 bps = 0.04% = Binance taker fee)
}

export interface CommissionResult {
  commissionUSDT: number;
  commissionPct: number;
}

/**
 * Calculate trading commission
 * Binance Futures: 0.04% taker, 0.02% maker
 * We use taker fee as conservative default (market orders)
 */
export function computeCommission(params: CommissionInput): CommissionResult {
  const { positionNotional, commissionBps } = params;

  const commissionPct = commissionBps / 10000;
  const commissionUSDT = positionNotional * commissionPct;

  return {
    commissionUSDT: round4(commissionUSDT),
    commissionPct: round4(commissionPct * 100),
  };
}

// ============================================================================
// Full Execution Cost (Entry + Exit)
// ============================================================================

export interface ExecutionCostInput {
  entryPrice: number;
  exitPrice: number;
  direction: 'LONG' | 'SHORT';
  positionNotional: number;
  slippageBps: number;
  commissionBps: number;
}

export interface ExecutionCostResult {
  effectiveEntryPrice: number;
  effectiveExitPrice: number;
  entrySlippageUSDT: number;
  exitSlippageUSDT: number;
  totalSlippageUSDT: number;
  entryCommissionUSDT: number;
  exitCommissionUSDT: number;
  totalCommissionUSDT: number;
  grossPnlUSDT: number;
  netPnlUSDT: number;
  totalCostUSDT: number;
}

/**
 * Compute full execution cost including slippage and commission
 * Used when closing a position to get realistic net P&L
 */
export function computeExecutionCost(params: ExecutionCostInput): ExecutionCostResult {
  const {
    entryPrice,
    exitPrice,
    direction,
    positionNotional,
    slippageBps,
    commissionBps,
  } = params;

  // Apply slippage to entry
  const entrySlippage = applySlippage({
    basePrice: entryPrice,
    direction,
    slippageBps,
    isEntry: true,
  });

  // Apply slippage to exit
  const exitSlippage = applySlippage({
    basePrice: exitPrice,
    direction,
    slippageBps,
    isEntry: false,
  });

  const effectiveEntryPrice = entrySlippage.effectivePrice;
  const effectiveExitPrice = exitSlippage.effectivePrice;

  // Calculate slippage costs in USDT (on full position)
  const entrySlippageUSDT = entrySlippage.slippageUSDT * (positionNotional / entryPrice);
  const exitSlippageUSDT = exitSlippage.slippageUSDT * (positionNotional / exitPrice);
  const totalSlippageUSDT = entrySlippageUSDT + exitSlippageUSDT;

  // Calculate commission (on full position)
  const entryCommission = computeCommission({ positionNotional, commissionBps });
  const exitCommission = computeCommission({ positionNotional, commissionBps });
  const totalCommissionUSDT = entryCommission.commissionUSDT + exitCommission.commissionUSDT;

  // Calculate P&L
  let grossPnlUSDT: number;
  if (direction === 'LONG') {
    const rawMove = (exitPrice - entryPrice) / entryPrice;
    grossPnlUSDT = positionNotional * rawMove;
  } else {
    // SHORT
    const rawMove = (entryPrice - exitPrice) / entryPrice;
    grossPnlUSDT = positionNotional * rawMove;
  }

  // Net P&L after costs
  const totalCostUSDT = totalSlippageUSDT + totalCommissionUSDT;
  const netPnlUSDT = grossPnlUSDT - totalCostUSDT;

  return {
    effectiveEntryPrice: round4(effectiveEntryPrice),
    effectiveExitPrice: round4(effectiveExitPrice),
    entrySlippageUSDT: round4(entrySlippageUSDT),
    exitSlippageUSDT: round4(exitSlippageUSDT),
    totalSlippageUSDT: round4(totalSlippageUSDT),
    entryCommissionUSDT: round4(entryCommission.commissionUSDT),
    exitCommissionUSDT: round4(exitCommission.commissionUSDT),
    totalCommissionUSDT: round4(totalCommissionUSDT),
    grossPnlUSDT: round4(grossPnlUSDT),
    netPnlUSDT: round4(netPnlUSDT),
    totalCostUSDT: round4(totalCostUSDT),
  };
}
