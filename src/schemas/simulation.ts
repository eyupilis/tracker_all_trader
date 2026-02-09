/**
 * Zod schemas for simulation/portfolio management endpoints (Sprint 1)
 * Following patterns from signals.ts
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const riskModelEnum = z.enum(['KELLY', 'RISK_BASED', 'FIXED']);
export type RiskModel = z.infer<typeof riskModelEnum>;

export const positionDirectionEnum = z.enum(['LONG', 'SHORT']);
export type PositionDirection = z.infer<typeof positionDirectionEnum>;

export const positionStatusEnum = z.enum(['OPEN', 'CLOSED', 'ALL']);
export type PositionStatus = z.infer<typeof positionStatusEnum>;

// ============================================================================
// Portfolio Schemas
// ============================================================================

export const portfolioSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  initialBalance: z.number(),
  currentBalance: z.number(),
  maxRiskPerTrade: z.number(),
  maxPortfolioRisk: z.number(),
  maxOpenPositions: z.number().int(),
  maxLeverageAllowed: z.number(),
  defaultSlippageBps: z.number().int(),
  defaultCommissionBps: z.number().int(),
  kellyFraction: z.number(),
  minSampleSize: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Portfolio = z.infer<typeof portfolioSchema>;

export const createPortfolioSchema = z.object({
  name: z.string().min(1).max(50),
  initialBalance: z.number().min(100).default(10000),
  maxRiskPerTrade: z.number().min(0.5).max(10).default(2),
  maxPortfolioRisk: z.number().min(1).max(50).default(10),
  maxOpenPositions: z.number().int().min(1).max(20).default(5),
  maxLeverageAllowed: z.number().min(1).max(125).default(20),
  defaultSlippageBps: z.number().int().min(0).max(200).default(10),
  defaultCommissionBps: z.number().int().min(0).max(50).default(4),
  kellyFraction: z.number().min(0.1).max(1).default(0.25),
  minSampleSize: z.number().int().min(5).max(100).default(20),
});

export type CreatePortfolioRequest = z.infer<typeof createPortfolioSchema>;

export const portfolioSnapshotSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  snapshotAt: z.string(),
  balance: z.number(),
  unrealizedPnl: z.number(),
  realizedPnl: z.number(),
  totalPnl: z.number(),
  openPositions: z.number().int(),
  totalValue: z.number(),
});

export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;

export const portfolioMetricSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  totalTrades: z.number().int(),
  winningTrades: z.number().int(),
  losingTrades: z.number().int(),
  winRate: z.number(),
  avgWin: z.number(),
  avgLoss: z.number(),
  profitFactor: z.number(),
  maxDrawdown: z.number(),
  maxConsecLosses: z.number().int(),
  maxConsecWins: z.number().int(),
  avgSlippageBps: z.number(),
  totalCommission: z.number(),
  updatedAt: z.string(),
});

export type PortfolioMetric = z.infer<typeof portfolioMetricSchema>;

export const portfolioPerformanceSchema = z.object({
  portfolio: portfolioSchema,
  metrics: portfolioMetricSchema,
  equityCurve: z.array(portfolioSnapshotSchema),
  currentPositions: z.array(z.any()), // SimulatedPosition
});

export type PortfolioPerformance = z.infer<typeof portfolioPerformanceSchema>;

// ============================================================================
// Position Sizing Schemas
// ============================================================================

export const positionSizingRequestSchema = z.object({
  symbol: z.string(),
  direction: positionDirectionEnum,
  model: riskModelEnum,
  portfolioId: z.string().optional(),
  riskPercentage: z.number().min(0.1).max(10).optional(),
  leverage: z.number().min(1).max(125).optional(),
  entryPrice: z.number().positive().optional(),
  stopLossPct: z.number().min(0.1).max(20).optional(),
  takeProfitPct: z.number().min(0.1).max(100).optional(),
});

export type PositionSizingRequest = z.infer<typeof positionSizingRequestSchema>;

export const positionSizingResponseSchema = z.object({
  marginNotional: z.number(),
  positionNotional: z.number(),
  leverage: z.number(),
  riskAmount: z.number(),
  stopLossPrice: z.number().optional(),
  takeProfitPrice: z.number().optional(),
  riskRewardRatio: z.number().optional(),
  kelly: z.number().optional(),
  reason: z.string().optional(),
});

export type PositionSizingResponse = z.infer<typeof positionSizingResponseSchema>;

// ============================================================================
// Position Management Schemas
// ============================================================================

export const openPositionWithRiskSchema = z.object({
  symbol: z.string(),
  direction: positionDirectionEnum,
  portfolioId: z.string().optional(),

  // Position sizing
  riskModel: riskModelEnum.optional(),
  riskPercentage: z.number().min(0.1).max(10).optional(),
  leverage: z.number().min(1).max(125).default(10),
  marginNotional: z.number().positive().optional(),

  // Entry
  entryPrice: z.number().positive().optional(),

  // Risk management
  stopLossPrice: z.number().positive().optional(),
  stopLossPct: z.number().min(0.1).max(20).optional(),
  takeProfitPrice: z.number().positive().optional(),
  takeProfitPct: z.number().min(0.1).max(100).optional(),
  trailingStopPct: z.number().min(0.1).max(20).optional(),

  // Execution modeling
  slippageBps: z.number().int().min(0).max(200).optional(),
  commissionBps: z.number().int().min(0).max(50).optional(),

  // Metadata
  notes: z.string().optional(),
});

export type OpenPositionWithRiskRequest = z.infer<typeof openPositionWithRiskSchema>;

export const updatePositionRiskSchema = z.object({
  stopLossPrice: z.number().positive().optional(),
  takeProfitPrice: z.number().positive().optional(),
  trailingStopPct: z.number().min(0.1).max(20).optional(),
});

export type UpdatePositionRiskRequest = z.infer<typeof updatePositionRiskSchema>;

export const simulatedPositionSchema = z.object({
  id: z.string(),
  platform: z.string(),
  symbol: z.string(),
  direction: z.string(),
  status: z.string(),
  leverage: z.number(),
  marginNotional: z.number(),
  positionNotional: z.number(),
  entryPrice: z.number(),
  exitPrice: z.number().nullable(),
  pnlUSDT: z.number().nullable(),
  roiPct: z.number().nullable(),

  // Risk management fields
  stopLossPrice: z.number().nullable(),
  takeProfitPrice: z.number().nullable(),
  trailingStopPct: z.number().nullable(),
  trailingStopTrigger: z.number().nullable(),
  lastPriceUpdate: z.number().nullable(),
  lastPriceCheckAt: z.string().nullable(),

  // Execution fields
  slippageBps: z.number().int(),
  commissionBps: z.number().int(),
  effectiveEntryPrice: z.number().nullable(),
  effectiveExitPrice: z.number().nullable(),
  totalCommissionUSDT: z.number().nullable(),

  // Position sizing
  riskModel: z.string().nullable(),
  riskPercentage: z.number().nullable(),
  portfolioId: z.string().nullable(),

  // Lifecycle
  source: z.string(),
  closeReason: z.string().nullable(),
  closeTriggerLeadId: z.string().nullable(),
  closeTriggerEventType: z.string().nullable(),
  notes: z.string().nullable(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SimulatedPosition = z.infer<typeof simulatedPositionSchema>;

// ============================================================================
// Monitoring Schemas
// ============================================================================

export const monitorResultSchema = z.object({
  checked: z.number().int(),
  closed: z.number().int(),
  updated: z.number().int(),
  errors: z.array(z.string()),
});

export type MonitorResult = z.infer<typeof monitorResultSchema>;

// ============================================================================
// API Response Schemas
// ============================================================================

export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(z.any()).optional(),
  });

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, any>;
};

export type ApiError = {
  success: false;
  error: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================================================
// Advanced Analytics Schemas (Sprint 2)
// ============================================================================

export const advancedMetricsSchema = z.object({
  sharpeRatio: z.number(),
  sortinoRatio: z.number(),
  calmarRatio: z.number(),
  var95: z.number(),
  cvar95: z.number(),
  maxDrawdown: z.number(),
  maxDrawdownDuration: z.number().int(),
  recoveryFactor: z.number(),
  profitFactor: z.number(),
  avgReturn: z.number(),
  stdDev: z.number(),
  downstdDev: z.number(),
});

export type AdvancedMetrics = z.infer<typeof advancedMetricsSchema>;

export const monteCarloResultSchema = z.object({
  simulations: z.array(z.number()),
  mean: z.number(),
  median: z.number(),
  stdDev: z.number(),
  confidence95Low: z.number(),
  confidence95High: z.number(),
  probabilityOfRuin: z.number(),
  worstCase: z.number(),
  bestCase: z.number(),
});

export type MonteCarloResult = z.infer<typeof monteCarloResultSchema>;

export const windowMetricsSchema = z.object({
  winRate: z.number(),
  avgWin: z.number(),
  avgLoss: z.number(),
  profitFactor: z.number(),
  totalTrades: z.number().int(),
});

export type WindowMetrics = z.infer<typeof windowMetricsSchema>;

export const walkForwardWindowSchema = z.object({
  windowIndex: z.number().int(),
  inSample: windowMetricsSchema,
  outSample: windowMetricsSchema,
  degradation: z.number(),
});

export type WalkForwardWindow = z.infer<typeof walkForwardWindowSchema>;

export const walkForwardResultSchema = z.object({
  windows: z.array(walkForwardWindowSchema),
  avgInSampleWinRate: z.number(),
  avgOutSampleWinRate: z.number(),
  correlation: z.number(),
  overfitScore: z.number(),
});

export type WalkForwardResult = z.infer<typeof walkForwardResultSchema>;

export const equityPointSchema = z.object({
  timestamp: z.string(),
  equity: z.number(),
  pnl: z.number(),
  cumulativePnl: z.number(),
  drawdown: z.number(),
  drawdownDuration: z.number().int(),
  underwater: z.boolean(),
});

export type EquityPoint = z.infer<typeof equityPointSchema>;

export const drawdownPeriodSchema = z.object({
  start: z.string(),
  end: z.string(),
  depth: z.number(),
  duration: z.number().int(),
});

export type DrawdownPeriod = z.infer<typeof drawdownPeriodSchema>;

export const equityCurveResultSchema = z.object({
  curve: z.array(equityPointSchema),
  maxDrawdown: z.number(),
  maxDrawdownDuration: z.number().int(),
  avgDrawdown: z.number(),
  drawdownPeriods: z.array(drawdownPeriodSchema),
});

export type EquityCurveResult = z.infer<typeof equityCurveResultSchema>;

// Backtest result storage schema
export const backtestResultSchema = z.object({
  id: z.string(),
  portfolioId: z.string().nullable(),
  symbolFilter: z.string().nullable(),
  dateRange: z.string(),
  totalTrades: z.number().int(),
  winRate: z.number(),
  avgWin: z.number(),
  avgLoss: z.number(),
  profitFactor: z.number(),
  netPnl: z.number(),
  maxDrawdown: z.number(),
  sharpeRatio: z.number().nullable(),
  sortinoRatio: z.number().nullable(),
  calmarRatio: z.number().nullable(),
  var95: z.number().nullable(),
  cvar95: z.number().nullable(),
  mcMean: z.number().nullable(),
  mcMedian: z.number().nullable(),
  mcStdDev: z.number().nullable(),
  mcConfidence95Low: z.number().nullable(),
  mcConfidence95High: z.number().nullable(),
  probabilityOfRuin: z.number().nullable(),
  wfInSampleWinRate: z.number().nullable(),
  wfOutSampleWinRate: z.number().nullable(),
  wfCorrelation: z.number().nullable(),
  wfOverfitScore: z.number().nullable(),
  createdAt: z.string(),
});

export type BacktestResult = z.infer<typeof backtestResultSchema>;
