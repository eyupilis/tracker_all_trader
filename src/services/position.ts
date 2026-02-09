import { prisma } from '../db/prisma.js';
import type { PositionInput } from '../schemas/ingest.js';

/**
 * Insert position snapshots from ingest payload
 */
export async function insertPositionSnapshots(
    positions: PositionInput[],
    fetchedAt: Date
): Promise<number> {
    if (positions.length === 0) {
        return 0;
    }

    const data = positions.map((pos) => ({
        platform: pos.platform || 'binance',
        leadId: pos.leadId,
        fetchedAt,
        symbol: pos.symbol,
        side: pos.side,
        contractType: pos.contractType ?? null,
        leverage: pos.leverage ?? null,
        size: pos.size,
        sizeAsset: pos.sizeAsset ?? null,
        entryPrice: pos.entryPrice,
        markPrice: pos.markPrice ?? null,
        marginUSDT: pos.marginUSDT ?? null,
        marginType: pos.marginType ?? null,
        pnlUSDT: pos.pnlUSDT ?? null,
        roePct: pos.roePct ?? null,
        raw: pos as object, // Store raw for debugging
    }));

    const result = await prisma.positionSnapshot.createMany({
        data,
        skipDuplicates: true,
    });

    return result.count;
}

/**
 * Get latest position snapshots for a lead trader
 * Returns only positions from the most recent fetchedAt timestamp
 */
export async function getLatestPositionsForTrader(
    leadId: string,
    platform: string = 'binance'
) {
    // First, get the latest fetchedAt timestamp
    const latestSnapshot = await prisma.positionSnapshot.findFirst({
        where: { leadId, platform },
        orderBy: { fetchedAt: 'desc' },
        select: { fetchedAt: true },
    });

    if (!latestSnapshot) {
        return [];
    }

    // Then get all positions at that timestamp
    return prisma.positionSnapshot.findMany({
        where: {
            leadId,
            platform,
            fetchedAt: latestSnapshot.fetchedAt,
        },
        orderBy: { symbol: 'asc' },
    });
}

/**
 * Get all unique leader IDs that have positions
 */
export async function getActiveLeaderIds(platform: string = 'binance') {
    const results = await prisma.positionSnapshot.findMany({
        where: { platform },
        select: { leadId: true },
        distinct: ['leadId'],
    });

    return results.map((r) => r.leadId);
}

/**
 * Get latest position snapshot timestamp for each leader
 */
export async function getLatestSnapshotTimestamps(platform: string = 'binance') {
    // Get distinct leadIds with their latest fetchedAt
    const results = await prisma.$queryRaw<Array<{ leadId: string; latestFetchedAt: Date }>>`
    SELECT 
      "leadId",
      MAX("fetchedAt") as "latestFetchedAt"
    FROM "PositionSnapshot"
    WHERE platform = ${platform}
    GROUP BY "leadId"
  `;

    return new Map(results.map((r) => [r.leadId, r.latestFetchedAt]));
}

/**
 * Get positions from latest snapshots across all leaders
 */
export async function getLatestPositionsForAggregation(platform: string = 'binance') {
    const timestampMap = await getLatestSnapshotTimestamps(platform);

    if (timestampMap.size === 0) {
        return [];
    }

    // Build conditions for each leader's latest timestamp
    const conditions = Array.from(timestampMap.entries()).map(([leadId, fetchedAt]) => ({
        leadId,
        fetchedAt,
        platform,
    }));

    // Fetch all positions matching these conditions
    return prisma.positionSnapshot.findMany({
        where: {
            OR: conditions,
        },
        select: {
            symbol: true,
            side: true,
            leadId: true,
        },
    });
}
