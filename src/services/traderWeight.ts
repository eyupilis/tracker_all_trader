/**
 * Trader Weight Service
 *
 * Computes and persists the consensus weight for each trader.
 *
 * Formula:
 *   traderWeight = baseWeight × (0.7 + 0.3 × winAdj) × availabilityPenalty
 *
 *   baseWeight         = (qualityScore / 100) × confidenceFactor
 *   confidenceFactor   = high:1.0, medium:0.7, low:0.4
 *   winAdj             = clamp(winRate ?? 0, 0, 1)
 *   availabilityPenalty = positionShow===true ? 1.0 : 0.6
 */

import { prisma } from '../db/prisma.js';
import { computeTraderMetrics } from './traderMetrics.js';
import { logger } from '../utils/logger.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface TraderWeightInput {
  qualityScore: number;                     // 0-100
  confidence: 'low' | 'medium' | 'high';
  winRate: number | null;                   // 0.0-1.0
  positionShow: boolean | null;             // null = unknown → treated as hidden
}

export interface TraderWeightResult {
  traderWeight: number;     // 0.0-1.0
  breakdown: {
    baseWeight: number;
    confidenceFactor: number;
    winAdj: number;
    availabilityPenalty: number;
  };
}

// ────────────────────────────────────────────────────────────
// Confidence factor map
// ────────────────────────────────────────────────────────────

const CONFIDENCE_FACTORS: Record<string, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
};

// ────────────────────────────────────────────────────────────
// Pure computation
// ────────────────────────────────────────────────────────────

/**
 * Compute trader weight from metrics inputs (pure function, no DB).
 */
export function computeTraderWeight(input: TraderWeightInput): TraderWeightResult {
  const confidenceFactor = CONFIDENCE_FACTORS[input.confidence] ?? 0.4;
  const baseWeight = (input.qualityScore / 100) * confidenceFactor;
  const winAdj = Math.min(Math.max(input.winRate ?? 0, 0), 1);
  const availabilityPenalty = input.positionShow === true ? 1.0 : 0.6;

  const traderWeight = baseWeight * (0.7 + 0.3 * winAdj) * availabilityPenalty;

  return {
    traderWeight: Math.round(traderWeight * 10000) / 10000, // 4 decimal precision
    breakdown: {
      baseWeight: Math.round(baseWeight * 10000) / 10000,
      confidenceFactor,
      winAdj: Math.round(winAdj * 10000) / 10000,
      availabilityPenalty,
    },
  };
}

// ────────────────────────────────────────────────────────────
// DB-backed computation + persist
// ────────────────────────────────────────────────────────────

/**
 * Compute metrics + weight for a trader and persist to TraderScore.
 *
 * 1. Reads latest RawIngest payload
 * 2. Computes metrics via computeTraderMetrics
 * 3. Reads positionShow from LeadTrader
 * 4. Computes weight via computeTraderWeight
 * 5. Persists to TraderScore
 *
 * Returns the computed traderWeight, or null if no data available.
 */
export async function updateTraderWeight(
  leadId: string,
  platform: string = 'binance',
): Promise<number | null> {
  // 1. Get latest raw ingest
  const latestIngest = await prisma.rawIngest.findFirst({
    where: { leadId },
    orderBy: { fetchedAt: 'desc' },
  });

  if (!latestIngest) {
    logger.debug({ leadId }, 'No ingest data for weight computation');
    return null;
  }

  // 2. Compute metrics
  const metrics = computeTraderMetrics(latestIngest.payload);

  // 3. Get positionShow from LeadTrader
  const trader = await prisma.leadTrader.findUnique({
    where: { id: leadId },
    select: { positionShow: true },
  });

  const positionShow = trader?.positionShow ?? null;

  // 4. Compute weight
  const { traderWeight, breakdown } = computeTraderWeight({
    qualityScore: metrics.qualityScore,
    confidence: metrics.confidence,
    winRate: metrics.winRate,
    positionShow,
  });

  // 5. Persist to TraderScore
  await prisma.traderScore.upsert({
    where: { leadId },
    update: {
      qualityScore: metrics.qualityScore,
      confidence: metrics.confidence,
      winRate: metrics.winRate,
      sampleSize: metrics.sampleSize,
      traderWeight,
    },
    create: {
      leadId,
      platform,
      score30d: 0,
      qualityScore: metrics.qualityScore,
      confidence: metrics.confidence,
      winRate: metrics.winRate,
      sampleSize: metrics.sampleSize,
      traderWeight,
    },
  });

  logger.debug(
    { leadId, traderWeight, breakdown },
    'Trader weight updated',
  );

  return traderWeight;
}
