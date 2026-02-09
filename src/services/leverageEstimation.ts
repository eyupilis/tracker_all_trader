/**
 * Leverage Estimation Service
 *
 * Estimates leverage for HIDDEN traders based on their historical VISIBLE positions
 * and recent orderHistory patterns.
 */

import { prisma } from '../db/prisma.js';

interface LeverageEstimate {
  estimatedLeverage: number | null;
  confidence: 'high' | 'medium' | 'low';
  sampleSize: number;
  method: 'historical_average' | 'peer_average' | 'default';
}

/**
 * Calculate average leverage from recent VISIBLE positions of a trader
 */
async function getHistoricalAverageLeverage(leadId: string): Promise<LeverageEstimate | null> {
  // Get recent PositionSnapshots where leverage is available (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.positionSnapshot.findMany({
    where: {
      leadId,
      leverage: { not: null, gt: 0 },
      fetchedAt: { gte: sevenDaysAgo },
    },
    select: {
      leverage: true,
    },
    take: 100,
  });

  if (snapshots.length === 0) return null;

  const leverages = snapshots.map(s => s.leverage).filter((l): l is number => l !== null && l > 0);
  if (leverages.length === 0) return null;

  const avgLeverage = Math.round(leverages.reduce((sum, l) => sum + l, 0) / leverages.length);

  // Confidence based on sample size
  let confidence: 'high' | 'medium' | 'low';
  if (leverages.length >= 20) confidence = 'high';
  else if (leverages.length >= 10) confidence = 'medium';
  else confidence = 'low';

  return {
    estimatedLeverage: avgLeverage,
    confidence,
    sampleSize: leverages.length,
    method: 'historical_average',
  };
}

/**
 * Calculate average leverage from peer traders (similar quality score)
 */
async function getPeerAverageLeverage(leadId: string): Promise<LeverageEstimate | null> {
  // Get trader's quality score
  const traderScore = await prisma.traderScore.findUnique({
    where: { leadId },
    select: { qualityScore: true },
  });

  if (!traderScore?.qualityScore) return null;

  // Find similar traders (±10 quality score)
  const minQuality = traderScore.qualityScore - 10;
  const maxQuality = traderScore.qualityScore + 10;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get average leverage from peer traders
  const result = await prisma.$queryRaw<Array<{ avgLeverage: number; count: number }>>`
    SELECT AVG(ps.leverage)::float as "avgLeverage", COUNT(*)::int as count
    FROM "PositionSnapshot" ps
    INNER JOIN "TraderScore" ts ON ps."leadId" = ts."leadId"
    WHERE ts."qualityScore" >= ${minQuality}
      AND ts."qualityScore" <= ${maxQuality}
      AND ps.leverage > 0
      AND ps."fetchedAt" >= ${sevenDaysAgo}
  `;

  if (result.length === 0 || !result[0].avgLeverage) return null;

  const avgLeverage = Math.round(result[0].avgLeverage);
  const count = result[0].count;

  return {
    estimatedLeverage: avgLeverage,
    confidence: count >= 50 ? 'medium' : 'low',
    sampleSize: count,
    method: 'peer_average',
  };
}

/**
 * Get estimated leverage for a HIDDEN trader
 * Tries multiple methods in order of reliability:
 * 1. Historical average (trader's own past visible positions)
 * 2. Peer average (similar quality traders)
 * 3. Default (conservative estimate)
 */
export async function estimateLeverageForHiddenTrader(leadId: string): Promise<LeverageEstimate> {
  // Try historical average first (most reliable)
  const historical = await getHistoricalAverageLeverage(leadId);
  if (historical) return historical;

  // Try peer average (less reliable)
  const peer = await getPeerAverageLeverage(leadId);
  if (peer) return peer;

  // Default fallback (conservative)
  return {
    estimatedLeverage: 10, // Conservative default
    confidence: 'low',
    sampleSize: 0,
    method: 'default',
  };
}

/**
 * Batch estimate leverages for multiple hidden traders
 */
export async function batchEstimateLeverages(
  leadIds: string[]
): Promise<Map<string, LeverageEstimate>> {
  const results = new Map<string, LeverageEstimate>();

  // Process in parallel
  await Promise.all(
    leadIds.map(async (leadId) => {
      const estimate = await estimateLeverageForHiddenTrader(leadId);
      results.set(leadId, estimate);
    })
  );

  return results;
}
