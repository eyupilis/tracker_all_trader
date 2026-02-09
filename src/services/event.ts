import { prisma } from '../db/prisma.js';
import type { EventInput } from '../schemas/ingest.js';

/**
 * Parse event time text to a Date object
 * Format: "MM-DD, HH:MM:SS" - we need to add the year from fetchedAt
 */
function parseEventTime(eventTimeText: string, fetchedAt: Date): Date | null {
    try {
        // Expected format: "02-04, 22:52:35"
        const match = eventTimeText.match(/(\d{2})-(\d{2}),\s*(\d{2}):(\d{2}):(\d{2})/);
        if (!match) {
            return null;
        }

        const [, month, day, hours, minutes, seconds] = match;
        const year = fetchedAt.getFullYear();

        // Create date with parsed values
        const eventDate = new Date(
            year,
            parseInt(month, 10) - 1, // Month is 0-indexed
            parseInt(day, 10),
            parseInt(hours, 10),
            parseInt(minutes, 10),
            parseInt(seconds, 10)
        );

        // Handle year rollover: if event date is in the future, it's from last year
        if (eventDate > fetchedAt) {
            eventDate.setFullYear(year - 1);
        }

        return eventDate;
    } catch {
        return null;
    }
}

/**
 * Insert events with deduplication based on event_key
 * Returns count of newly inserted events
 */
export async function insertEvents(
    events: EventInput[],
    fetchedAt: Date
): Promise<{ inserted: number; skipped: number }> {
    if (events.length === 0) {
        return { inserted: 0, skipped: 0 };
    }

    // Prepare all event data
    const data = events.map((event) => {
        const eventTime = parseEventTime(event.eventTimeText, fetchedAt);
        return {
            platform: event.platform || 'binance',
            leadId: event.leadId,
            eventKey: event.event_key,
            eventType: event.eventType,
            symbol: event.symbol,
            eventTimeText: event.eventTimeText,
            eventTime,
            price: event.price ?? null,
            amount: event.amount ?? null,
            amountAsset: event.amountAsset ?? null,
            realizedPnl: event.realizedPnl ?? null,
            fetchedAt,
        };
    });

    // Use createMany with skipDuplicates to avoid unique constraint errors
    const result = await prisma.event.createMany({
        data,
        skipDuplicates: true,
    });

    const inserted = result.count;
    const skipped = events.length - inserted;

    return { inserted, skipped };
}

/**
 * Get events for a symbol, ordered by eventTime descending
 */
export async function getEventsBySymbol(
    symbol: string,
    platform: string = 'binance',
    limit: number = 50
) {
    return prisma.event.findMany({
        where: { symbol, platform },
        orderBy: [
            { eventTime: 'desc' },
            { createdAt: 'desc' },
        ],
        take: limit,
        select: {
            eventType: true,
            eventTimeText: true,
            eventTime: true,
            leadId: true,
            price: true,
            amount: true,
            realizedPnl: true,
            eventKey: true,
        },
    });
}

/**
 * Get latest event for each symbol
 */
export async function getLatestEventsBySymbol(platform: string = 'binance') {
    const results = await prisma.$queryRaw<
        Array<{
            symbol: string;
            latestEventAt: Date | null;
            eventKey: string | null;
        }>
    >`
    SELECT DISTINCT ON (symbol)
      symbol,
      "eventTime" as "latestEventAt",
      "eventKey"
    FROM "Event"
    WHERE platform = ${platform}
    ORDER BY symbol, "eventTime" DESC NULLS LAST
  `;

    return new Map(
        results.map((r) => [
            r.symbol,
            { latestEventAt: r.latestEventAt, eventKey: r.eventKey },
        ])
    );
}

/**
 * Get realized PnL sum for a trader in the last N days
 */
export async function getRealizedPnlSum(
    leadId: string,
    platform: string = 'binance',
    days: number = 30
): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.event.aggregate({
        where: {
            leadId,
            platform,
            eventType: { in: ['CLOSE_LONG', 'CLOSE_SHORT'] },
            eventTime: { gte: cutoffDate },
            realizedPnl: { not: null },
        },
        _sum: {
            realizedPnl: true,
        },
    });

    return result._sum.realizedPnl ?? 0;
}
