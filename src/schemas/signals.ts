/**
 * Signal API Contract Schemas (FAZ 0)
 *
 * Zod schemas defining the formal contract for all /signals/* endpoints.
 * Single source of truth for request/response validation.
 */

import { z } from 'zod';

// ────────────────────────────────────────────────────────────
// Enums & Shared
// ────────────────────────────────────────────────────────────

export const traderSegmentEnum = z.enum(['VISIBLE', 'HIDDEN', 'UNKNOWN']);
export type TraderSegment = z.infer<typeof traderSegmentEnum>;

export const confidenceEnum = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof confidenceEnum>;

export const sentimentEnum = z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']);
export type Sentiment = z.infer<typeof sentimentEnum>;

// ────────────────────────────────────────────────────────────
// Request Schemas
// ────────────────────────────────────────────────────────────

export const heatmapQuerySchema = z.object({
  timeRange: z.enum(['1h', '4h', '24h', '7d', 'ALL']).default('24h'),
  side: z.enum(['ALL', 'LONG', 'SHORT']).default('ALL'),
  minTraders: z.coerce.number().int().min(1).default(1),
  leverage: z.enum(['ALL', '<20x', '20-50x', '50-100x', '>100x']).default('ALL'),
  segment: z.enum(['VISIBLE', 'HIDDEN', 'BOTH']).default('BOTH'),
});
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;

export const symbolQuerySchema = z.object({
  timeRange: z.enum(['1h', '4h', '24h', '7d', 'ALL']).default('24h'),
  segment: z.enum(['VISIBLE', 'HIDDEN', 'BOTH']).default('BOTH'),
});

export const feedQuerySchema = z.object({
  source: z.enum(['all', 'positions', 'derived']).default('all'),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  symbol: z.string().optional(),
  timeRange: z.enum(['1h', '4h', '24h', '7d', 'ALL']).default('24h'),
  segment: z.enum(['VISIBLE', 'HIDDEN', 'BOTH']).default('BOTH'),
});

export const insightsQuerySchema = z.object({
  timeRange: z.enum(['1h', '4h', '24h', '7d', 'ALL']).default('24h'),
  segment: z.enum(['VISIBLE', 'HIDDEN', 'BOTH']).default('BOTH'),
  top: z.coerce.number().int().min(3).max(50).default(10),
  mode: z.enum(['conservative', 'balanced', 'aggressive']).default('balanced'),
});

export const insightsPresetSchema = z.object({
  crowdedMinTraders: z.number().int().min(1).max(20),
  crowdedMinConfidence: z.number().int().min(0).max(100),
  crowdedMinSentimentAbs: z.number().int().min(0).max(100),
  lowConfidenceLimit: z.number().int().min(0).max(100),
  highLeverageThreshold: z.number().min(1).max(300),
  extremeLeverageThreshold: z.number().min(1).max(500),
  unstableMinFlips: z.number().int().min(1).max(20),
  unstableHighFlips: z.number().int().min(1).max(20),
  unstableMinUpdates: z.number().int().min(1).max(100),
  scoreMultiplier: z.number().min(0.1).max(3),
});
export type InsightsPreset = z.infer<typeof insightsPresetSchema>;

export const insightsRuleUpdateSchema = z.object({
  defaultMode: z.enum(['conservative', 'balanced', 'aggressive']).optional(),
  presets: z.object({
    conservative: insightsPresetSchema.partial().optional(),
    balanced: insightsPresetSchema.partial().optional(),
    aggressive: insightsPresetSchema.partial().optional(),
  }).optional(),
});
export type InsightsRuleUpdate = z.infer<typeof insightsRuleUpdateSchema>;

export const simulationPositionsQuerySchema = z.object({
  status: z.enum(['OPEN', 'CLOSED', 'ALL']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  reconcile: z.string().optional(),
});

export const autoRunQuerySchema = z.object({
  dryRun: z.string().optional(),
});

export const backtestLiteQuerySchema = z.object({
  timeRange: z.enum(['1h', '4h', '24h', '7d', 'ALL']).optional(),
  minTraders: z.coerce.number().int().min(1).optional(),
  minConfidence: z.coerce.number().int().min(0).max(100).optional(),
  minSentimentAbs: z.coerce.number().int().min(0).max(100).optional(),
  leverage: z.coerce.number().positive().optional(),
  marginNotional: z.coerce.number().positive().optional(),
  segment: z.enum(['VISIBLE', 'HIDDEN', 'BOTH']).optional(),
});

// ────────────────────────────────────────────────────────────
// Response Schemas
// ────────────────────────────────────────────────────────────

export const consensusDirectionEnum = z.enum(['LONG', 'SHORT', 'NEUTRAL']);
export type ConsensusDirection = z.infer<typeof consensusDirectionEnum>;

export const heatmapTraderSchema = z.object({
  leadId: z.string(),
  nickname: z.string(),
  side: z.enum(['LONG', 'SHORT']),
  leverage: z.number(),
  traderWeight: z.number().nullable(),
  entryPrice: z.number(),
  isDerived: z.boolean().optional(),
  derivedConfidence: z.number().min(0).max(1).nullable().optional(),
});

export const heatmapItemSchema = z.object({
  symbol: z.string(),
  longCount: z.number().int(),
  shortCount: z.number().int(),
  totalTraders: z.number().int(),
  avgLeverage: z.number(),
  weightedAvgLeverage: z.number(),
  totalVolume: z.number(),
  longVolume: z.number(),
  shortVolume: z.number(),
  imbalance: z.number().int(),
  sentiment: sentimentEnum,
  // FAZ 1: consensus fields
  sentimentScore: z.number().min(-1).max(1),       // weighted: -1=full short, +1=full long
  consensusDirection: consensusDirectionEnum,        // sign(sentimentScore)
  confidenceScore: z.number().int().min(0).max(100), // 0=no consensus, 100=full agreement
  sumWeights: z.number(),                            // total trader weights for this symbol
  derivedConfidenceAvg: z.number().int().min(0).max(100).nullable().optional(),
  dataSource: z.enum(['VISIBLE', 'HIDDEN_DERIVED', 'MIXED']).optional(),
  visibleTraderCount: z.number().int().optional(),
  hiddenTraderCount: z.number().int().optional(),
  topTraders: z.array(heatmapTraderSchema),          // traders sorted by weight
});
export type HeatmapItem = z.infer<typeof heatmapItemSchema>;

export const traderSummarySchema = z.object({
  leadId: z.string(),
  nickname: z.string(),
  avatarUrl: z.string(),
  badgeName: z.string(),
  positionsCount: z.number().int(),
  totalPnl: z.number(),
  lastUpdate: z.string().or(z.date()),
  // FAZ 0 fields
  positionShow: z.boolean().nullable(),
  segment: traderSegmentEnum,
  qualityScore: z.number().int().min(0).max(100).nullable(),
  traderWeight: z.number().min(0).max(1).nullable(),
  confidence: confidenceEnum.nullable(),
  winRate: z.number().min(0).max(1).nullable(),
  isDerived: z.boolean().optional(),
  derivedConfidence: z.number().min(0).max(1).nullable().optional(),
  lastAction: z.string().nullable().optional(),
});
export type TraderSummary = z.infer<typeof traderSummarySchema>;

export const symbolDetailTraderSchema = z.object({
  leadId: z.string(),
  nickname: z.string(),
  avatarUrl: z.string(),
  side: z.enum(['LONG', 'SHORT']),
  leverage: z.number(),
  entryPrice: z.number(),
  markPrice: z.number(),
  size: z.number(),
  pnl: z.number(),
  pnlPercent: z.number(),
  // FAZ 1
  traderWeight: z.number().nullable(),
  segment: traderSegmentEnum.nullable(),
  // FAZ 2
  qualityScore: z.number().int().min(0).max(100).nullable(),
  confidence: confidenceEnum.nullable(),
  winRate: z.number().min(0).max(1).nullable(),
});

export const symbolDetailSchema = z.object({
  symbol: z.string(),
  summary: z.object({
    longCount: z.number().int(),
    shortCount: z.number().int(),
    totalTraders: z.number().int(),
    totalLongVolume: z.number(),
    totalShortVolume: z.number(),
    avgEntryLong: z.number(),
    avgEntryShort: z.number(),
    weightedAvgEntryLong: z.number(),
    weightedAvgEntryShort: z.number(),
    sentiment: sentimentEnum,
    sentimentScore: z.number().min(-1).max(1),
    consensusDirection: consensusDirectionEnum,
    confidenceScore: z.number().int().min(0).max(100),
    sumWeights: z.number(),
    derivedConfidenceAvg: z.number().int().min(0).max(100).nullable().optional(),
  }),
  traders: z.array(symbolDetailTraderSchema),
});
export type SymbolDetailResponse = z.infer<typeof symbolDetailSchema>;

export const feedItemSchema = z.object({
  leadId: z.string(),
  nickname: z.string(),
  symbol: z.string(),
  action: z.string(),
  side: z.string(),
  notional: z.number(),
  leverage: z.number().nullable(),
  pnl: z.number(),
  timestamp: z.number(),
  source: z.enum(['POSITIONS', 'DERIVED']),
  segment: traderSegmentEnum,
  traderWeight: z.number().nullable(),
  qualityScore: z.number().int().min(0).max(100).nullable(),
  confidence: confidenceEnum.nullable(),
  winRate: z.number().min(0).max(1).nullable(),
});
export type FeedItem = z.infer<typeof feedItemSchema>;

export const simulatedPositionSchema = z.object({
  id: z.string(),
  platform: z.string(),
  symbol: z.string(),
  direction: z.enum(['LONG', 'SHORT']),
  status: z.enum(['OPEN', 'CLOSED']),
  leverage: z.number(),
  marginNotional: z.number(),
  positionNotional: z.number(),
  entryPrice: z.number(),
  exitPrice: z.number().nullable(),
  pnlUSDT: z.number().nullable(),
  roiPct: z.number().nullable(),
  source: z.string(),
  closeReason: z.string().nullable(),
  closeTriggerLeadId: z.string().nullable(),
  closeTriggerEventType: z.string().nullable(),
  notes: z.string().nullable(),
  openedAt: z.string().or(z.date()),
  closedAt: z.string().or(z.date()).nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type SimulatedPosition = z.infer<typeof simulatedPositionSchema>;

export const autoTriggerRuleSchema = z.object({
  id: z.string(),
  platform: z.string(),
  enabled: z.boolean(),
  segment: z.enum(['VISIBLE', 'HIDDEN', 'BOTH']),
  timeRange: z.enum(['1h', '4h', '24h', '7d', 'ALL']),
  minTraders: z.number().int().min(1),
  minConfidence: z.number().int().min(0).max(100),
  minSentimentAbs: z.number().int().min(0).max(100),
  leverage: z.number().positive(),
  marginNotional: z.number().positive(),
  cooldownMinutes: z.number().int().min(0),
  lastRunAt: z.string().or(z.date()).nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type AutoTriggerRule = z.infer<typeof autoTriggerRuleSchema>;

export const backtestTradeSchema = z.object({
  symbol: z.string(),
  direction: z.enum(['LONG', 'SHORT']),
  openedAt: z.string(),
  closedAt: z.string(),
  entryPrice: z.number(),
  exitPrice: z.number(),
  pnlUSDT: z.number(),
  roiPct: z.number(),
  triggerCount: z.number().int(),
  confidenceScore: z.number().int(),
  sentimentScore: z.number(),
  closeEventType: z.string(),
  closeLeadId: z.string(),
});
export type BacktestTrade = z.infer<typeof backtestTradeSchema>;

export const autoRunCandidateSchema = z.object({
  symbol: z.string(),
  longCount: z.number().int(),
  shortCount: z.number().int(),
  totalTraders: z.number().int(),
  longWeight: z.number(),
  shortWeight: z.number(),
  sentimentScore: z.number().min(-1).max(1),
  consensusDirection: consensusDirectionEnum,
  confidenceScore: z.number().int().min(0).max(100),
});
export type AutoRunCandidate = z.infer<typeof autoRunCandidateSchema>;

export const autoRunSkipSchema = z.object({
  symbol: z.string(),
  reason: z.string(),
});
export type AutoRunSkip = z.infer<typeof autoRunSkipSchema>;

export const autoRunResultSchema = z.object({
  rule: autoTriggerRuleSchema,
  reconciledCount: z.number().int().min(0),
  openedCount: z.number().int().min(0),
  closedCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
  opened: z.array(z.record(z.unknown())),
  closed: z.array(z.record(z.unknown())),
  skipped: z.array(autoRunSkipSchema),
  candidates: z.array(autoRunCandidateSchema),
  status: z.string().optional(),
});
export type AutoRunResult = z.infer<typeof autoRunResultSchema>;

export const backtestLiteResponseSchema = z.object({
  config: z.object({
    timeRange: z.enum(['1h', '4h', '24h', '7d', 'ALL']),
    segmentFilter: z.enum(['VISIBLE', 'HIDDEN', 'BOTH']),
    minTraders: z.number().int().min(1),
    minConfidence: z.number().int().min(0).max(100),
    minSentimentAbs: z.number().int().min(0).max(100),
    leverage: z.number().positive(),
    marginNotional: z.number().positive(),
    startTime: z.string(),
  }),
  summary: z.object({
    trades: z.number().int().min(0),
    wins: z.number().int().min(0),
    losses: z.number().int().min(0),
    breakeven: z.number().int().min(0),
    winRate: z.number(),
    totalPnl: z.number(),
    avgPnl: z.number(),
    avgRoiPct: z.number(),
  }),
  bySymbol: z.array(z.object({
    symbol: z.string(),
    trades: z.number().int().min(0),
    totalPnl: z.number(),
    winRate: z.number(),
  })),
  trades: z.array(backtestTradeSchema),
});
export type BacktestLiteResponse = z.infer<typeof backtestLiteResponseSchema>;

export const insightsSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type InsightsSeverity = z.infer<typeof insightsSeverityEnum>;

export const insightsAnomalySchema = z.object({
  type: z.string(),
  severity: insightsSeverityEnum,
  symbol: z.string(),
  message: z.string(),
  metric: z.string(),
  value: z.number(),
});
export type InsightsAnomaly = z.infer<typeof insightsAnomalySchema>;

export const insightsStabilitySchema = z.object({
  symbol: z.string(),
  updates: z.number().int().min(0),
  flips: z.number().int().min(0),
  flipRate: z.number().min(0),
  stabilityScore: z.number().int().min(0).max(100),
  lastDirection: consensusDirectionEnum,
});
export type InsightsStability = z.infer<typeof insightsStabilitySchema>;

export const insightsLeaderboardSchema = z.object({
  rank: z.number().int().min(1),
  leadId: z.string(),
  nickname: z.string(),
  segment: traderSegmentEnum,
  traderWeight: z.number().min(0).max(1),
  qualityScore: z.number().int().min(0).max(100).nullable(),
  confidence: confidenceEnum.nullable(),
  winRate: z.number().min(0).max(1).nullable(),
  activityEvents: z.number().int().min(0),
  avgLeverage: z.number().min(0),
  realizedPnl: z.number(),
  score: z.number().min(0),
});
export type InsightsLeaderboard = z.infer<typeof insightsLeaderboardSchema>;

export const insightsResponseSchema = z.object({
  generatedAt: z.string(),
  filters: z.object({
    timeRange: z.enum(['1h', '4h', '24h', '7d', 'ALL']),
    segment: z.enum(['VISIBLE', 'HIDDEN', 'BOTH']),
    top: z.number().int().min(3).max(50),
    mode: z.enum(['conservative', 'balanced', 'aggressive']),
  }),
  riskOverview: z.object({
    score: z.number().min(0).max(100),
    level: insightsSeverityEnum,
    crowdedSymbols: z.number().int().min(0),
    highLeverageSymbols: z.number().int().min(0),
    unstableSymbols: z.number().int().min(0),
    lowConfidenceSymbols: z.number().int().min(0),
  }),
  anomalies: z.array(insightsAnomalySchema),
  stability: z.array(insightsStabilitySchema),
  leaderboard: z.array(insightsLeaderboardSchema),
});
export type InsightsResponse = z.infer<typeof insightsResponseSchema>;

export const insightsRuleSchema = z.object({
  id: z.string(),
  platform: z.string(),
  defaultMode: z.enum(['conservative', 'balanced', 'aggressive']),
  presets: z.object({
    conservative: insightsPresetSchema,
    balanced: insightsPresetSchema,
    aggressive: insightsPresetSchema,
  }),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type InsightsRule = z.infer<typeof insightsRuleSchema>;

export const weightBreakdownSchema = z.object({
  baseWeight: z.number(),
  confidenceFactor: z.number(),
  winAdj: z.number(),
  availabilityPenalty: z.number(),
});

export const diagnosticSchema = z.object({
  leadId: z.string(),
  nickname: z.string().nullable(),
  segment: z.object({
    positionShow: z.boolean().nullable(),
    posShowUpdatedAt: z.string().nullable(),
    staleness: z.enum(['fresh', 'stale_1h', 'stale_24h', 'never_set']),
  }),
  dataCompleteness: z.object({
    hasRawIngest: z.boolean(),
    latestIngestAt: z.string().nullable(),
    ingestAgeMinutes: z.number().nullable(),
    hasPositionSnapshots: z.boolean(),
    snapshotCount: z.number().int(),
    hasEvents: z.boolean(),
    eventCount30d: z.number().int(),
    hasOrderHistory: z.boolean(),
    orderCount: z.number().int(),
    hasRoiSeries: z.boolean(),
    roiDataPoints: z.number().int(),
    hasPortfolioDetail: z.boolean(),
  }),
  scoring: z.object({
    score30d: z.number().nullable(),
    qualityScore: z.number().int().min(0).max(100).nullable(),
    confidence: confidenceEnum.nullable(),
    winRate: z.number().min(0).max(1).nullable(),
    traderWeight: z.number().min(0).max(1).nullable(),
    weightBreakdown: weightBreakdownSchema.nullable(),
  }),
  issues: z.array(z.string()),
});
export type Diagnostic = z.infer<typeof diagnosticSchema>;

export const diagnosticSummarySchema = z.object({
  traders: z.array(diagnosticSchema),
  summary: z.object({
    totalTraders: z.number().int(),
    visibleTraders: z.number().int(),
    hiddenTraders: z.number().int(),
    unknownSegment: z.number().int(),
    tradersWithIssues: z.number().int(),
    averageWeight: z.number(),
    readyForConsensus: z.boolean(),
  }),
});
export type DiagnosticSummary = z.infer<typeof diagnosticSummarySchema>;
