import { prisma } from '../db/prisma.js';
import { getLatestPositionsForAggregation } from './position.js';
import { getLatestEventsBySymbol } from './event.js';

interface AggregationResult {
    symbol: string;
    openLongCount: number;
    openShortCount: number;
    totalOpen: number;
}

/**
 * Recompute symbol aggregations based on latest position snapshots
 */
export async function recomputeAggregations(
    platform: string = 'binance'
): Promise<number> {
    // Get all positions from latest snapshots
    const positions = await getLatestPositionsForAggregation(platform);

    // Aggregate by symbol
    const symbolAggMap = new Map<string, AggregationResult>();

    for (const pos of positions) {
        if (!symbolAggMap.has(pos.symbol)) {
            symbolAggMap.set(pos.symbol, {
                symbol: pos.symbol,
                openLongCount: 0,
                openShortCount: 0,
                totalOpen: 0,
            });
        }

        const agg = symbolAggMap.get(pos.symbol)!;
        if (pos.side === 'LONG') {
            agg.openLongCount++;
        } else if (pos.side === 'SHORT') {
            agg.openShortCount++;
        }
        agg.totalOpen = agg.openLongCount + agg.openShortCount;
    }

    // Get latest events for each symbol
    const latestEvents = await getLatestEventsBySymbol(platform);

    // Upsert aggregations
    const upsertPromises = Array.from(symbolAggMap.values()).map((agg) => {
        const eventInfo = latestEvents.get(agg.symbol);
        return prisma.symbolAggregation.upsert({
            where: {
                platform_symbol: { platform, symbol: agg.symbol },
            },
            update: {
                openLongCount: agg.openLongCount,
                openShortCount: agg.openShortCount,
                totalOpen: agg.totalOpen,
                latestEventAt: eventInfo?.latestEventAt ?? null,
                latestEventKey: eventInfo?.eventKey ?? null,
            },
            create: {
                platform,
                symbol: agg.symbol,
                openLongCount: agg.openLongCount,
                openShortCount: agg.openShortCount,
                totalOpen: agg.totalOpen,
                latestEventAt: eventInfo?.latestEventAt ?? null,
                latestEventKey: eventInfo?.eventKey ?? null,
            },
        });
    });

    await Promise.all(upsertPromises);

    // Clean up symbols with no open positions
    await prisma.symbolAggregation.deleteMany({
        where: {
            platform,
            totalOpen: 0,
            symbol: { notIn: Array.from(symbolAggMap.keys()) },
        },
    });

    return symbolAggMap.size;
}

/**
 * Get symbol aggregations ordered by totalOpen
 */
export async function getSymbolAggregations(
    platform: string = 'binance',
    limit: number = 50,
    offset: number = 0
) {
    return prisma.symbolAggregation.findMany({
        where: { platform },
        orderBy: { totalOpen: 'desc' },
        take: limit,
        skip: offset,
        select: {
            symbol: true,
            openLongCount: true,
            openShortCount: true,
            totalOpen: true,
            latestEventAt: true,
        },
    });
}

/**
 * Get total count of symbol aggregations
 */
export async function getSymbolAggregationsCount(platform: string = 'binance') {
    return prisma.symbolAggregation.count({
        where: { platform },
    });
}
