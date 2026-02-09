/**
 * Position State Tracking Service (Yol 2)
 *
 * Tracks position lifecycle by comparing snapshots across curl requests.
 * Provides estimated open/close times with ±30-60s uncertainty range.
 *
 * How it works:
 * 1. Each curl request (every ~60s) brings new position snapshots
 * 2. Compare current vs previous snapshots to detect:
 *    - NEW positions (just appeared) → create PositionState with firstSeenAt
 *    - EXISTING positions (still there) → update lastSeenAt
 *    - DISAPPEARED positions (gone) → mark as CLOSED with disappearedAt
 * 3. Calculate estimated times:
 *    - estimatedOpenTime = midpoint between (lastFetchBefore, firstSeenAt)
 *    - estimatedCloseTime = midpoint between (lastSeenAt, disappearedAt)
 *
 * Uncertainty: ±30-60 seconds (half the curl interval)
 */

import { prisma } from '../db/prisma.js';
import type { PositionInput } from '../schemas/ingest.js';

interface PositionKey {
  leadId: string;
  symbol: string;
  direction: string; // LONG | SHORT
}

interface PositionStateUpdate {
  newPositions: number;
  updatedPositions: number;
  closedPositions: number;
}

/**
 * Generate unique position key for tracking
 */
function getPositionKey(pos: PositionInput): string {
  return `${pos.leadId}|${pos.symbol}|${pos.side}`;
}

/**
 * Parse position key back to components
 */
function parsePositionKey(key: string): PositionKey {
  const [leadId, symbol, direction] = key.split('|');
  return { leadId, symbol, direction };
}

/**
 * Track position states by comparing current snapshot with database state
 *
 * @param positions - Current positions from this curl request
 * @param fetchedAt - Timestamp of this curl request
 * @param platform - Trading platform (default: binance)
 * @returns Statistics about state changes
 */
export async function trackPositionStates(
  positions: PositionInput[],
  fetchedAt: Date,
  platform: string = 'binance'
): Promise<PositionStateUpdate> {
  const currentKeys = new Set(positions.map(getPositionKey));
  const positionMap = new Map(
    positions.map((p) => [getPositionKey(p), p])
  );

  // Get all ACTIVE position states for affected traders
  const leadIds = [...new Set(positions.map((p) => p.leadId))];

  const activeStates = await prisma.positionState.findMany({
    where: {
      platform,
      leadId: { in: leadIds },
      status: 'ACTIVE',
    },
  });

  const activeKeys = new Set(
    activeStates.map((s) => `${s.leadId}|${s.symbol}|${s.direction}`)
  );

  // Detect NEW positions (in current snapshot but not in active states)
  const newKeys = [...currentKeys].filter((key) => !activeKeys.has(key));

  // Detect DISAPPEARED positions (in active states but not in current snapshot)
  const disappearedKeys = [...activeKeys].filter(
    (key) => !currentKeys.has(key)
  );

  // Detect STILL ACTIVE positions (in both)
  const stillActiveKeys = [...activeKeys].filter((key) => currentKeys.has(key));

  let newCount = 0;
  let updatedCount = 0;
  let closedCount = 0;

  // ================================================================
  // 1. CREATE new position states
  // ================================================================
  for (const key of newKeys) {
    const pos = positionMap.get(key)!;

    // Try to find matching OPEN event from orderHistory for accurate timing
    const openEventType = pos.side === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT';

    // Search for recent OPEN events (within last 5 minutes before firstSeenAt)
    const fiveMinutesAgo = new Date(fetchedAt.getTime() - 5 * 60 * 1000);
    const matchingOpenEvent = await prisma.event.findFirst({
      where: {
        platform,
        leadId: pos.leadId,
        symbol: pos.symbol,
        eventType: openEventType,
        eventTime: {
          gte: fiveMinutesAgo,
          lte: fetchedAt,
        },
      },
      orderBy: {
        eventTime: 'desc', // Get the most recent one
      },
    });

    // Use Event time if available, otherwise use firstSeenAt as conservative estimate
    const estimatedOpenTime = matchingOpenEvent?.eventTime || fetchedAt;
    const openEventId = matchingOpenEvent?.id || null;

    await prisma.positionState.create({
      data: {
        platform,
        leadId: pos.leadId,
        symbol: pos.symbol,
        direction: pos.side,
        status: 'ACTIVE',
        entryPrice: pos.entryPrice,
        amount: pos.size,
        leverage: pos.leverage,
        firstSeenAt: fetchedAt,
        lastSeenAt: fetchedAt,
        estimatedOpenTime,
        openEventId, // Link to Event for accurate timing
      },
    });

    newCount++;
  }

  // ================================================================
  // 2. UPDATE still active positions (just update lastSeenAt)
  // ================================================================
  if (stillActiveKeys.length > 0) {
    const stillActiveIds = activeStates
      .filter((s) =>
        stillActiveKeys.includes(`${s.leadId}|${s.symbol}|${s.direction}`)
      )
      .map((s) => s.id);

    const result = await prisma.positionState.updateMany({
      where: {
        id: { in: stillActiveIds },
      },
      data: {
        lastSeenAt: fetchedAt,
      },
    });

    updatedCount = result.count;
  }

  // ================================================================
  // 3. CLOSE disappeared positions
  // ================================================================
  for (const key of disappearedKeys) {
    const { leadId, symbol, direction } = parsePositionKey(key);

    const state = activeStates.find(
      (s) =>
        s.leadId === leadId &&
        s.symbol === symbol &&
        s.direction === direction
    );

    if (!state) continue;

    // Estimate close time: midpoint between lastSeenAt and now
    const estimatedCloseTime = new Date(
      (state.lastSeenAt.getTime() + fetchedAt.getTime()) / 2
    );

    await prisma.positionState.update({
      where: { id: state.id },
      data: {
        status: 'CLOSED',
        disappearedAt: fetchedAt,
        estimatedCloseTime,
      },
    });

    closedCount++;
  }

  return {
    newPositions: newCount,
    updatedPositions: updatedCount,
    closedPositions: closedCount,
  };
}

/**
 * Get active position states for a trader
 * Sorted by estimated open time (most recent first)
 */
export async function getActivePositionStates(
  leadId: string,
  platform: string = 'binance'
) {
  return prisma.positionState.findMany({
    where: {
      platform,
      leadId,
      status: 'ACTIVE',
    },
    orderBy: {
      // Sort by estimatedOpenTime if available, otherwise firstSeenAt (newest first)
      estimatedOpenTime: 'desc',
    },
  });
}

/**
 * Get position state history for a symbol
 * Sorted by estimated open time (most recent first)
 */
export async function getPositionStateHistory(
  symbol: string,
  platform: string = 'binance',
  limit: number = 50
) {
  return prisma.positionState.findMany({
    where: {
      platform,
      symbol,
    },
    orderBy: {
      // Sort by estimatedOpenTime if available, otherwise firstSeenAt (newest first)
      estimatedOpenTime: 'desc',
    },
    take: limit,
  });
}

/**
 * Get recently closed positions (for analysis)
 */
export async function getRecentlyClosedPositions(
  platform: string = 'binance',
  hoursAgo: number = 24,
  limit: number = 100
) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursAgo);

  return prisma.positionState.findMany({
    where: {
      platform,
      status: 'CLOSED',
      disappearedAt: {
        gte: cutoff,
      },
    },
    orderBy: {
      disappearedAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Calculate uncertainty range for a position state
 * Returns [earliestPossible, latestPossible] for open/close times
 */
export function calculateUncertaintyRange(state: {
  firstSeenAt: Date;
  lastSeenAt: Date;
  disappearedAt: Date | null;
  estimatedOpenTime: Date | null;
  estimatedCloseTime: Date | null;
}): {
  openRange: { earliest: Date; latest: Date; uncertainty: number };
  closeRange: { earliest: Date; latest: Date; uncertainty: number } | null;
} {
  // For OPEN: uncertainty is from creation of tracker until firstSeenAt
  // Conservative: assume opened right at firstSeenAt
  const openEarliest = state.estimatedOpenTime || state.firstSeenAt;
  const openLatest = state.firstSeenAt;
  const openUncertainty =
    (openLatest.getTime() - openEarliest.getTime()) / 1000; // seconds

  const result: ReturnType<typeof calculateUncertaintyRange> = {
    openRange: {
      earliest: openEarliest,
      latest: openLatest,
      uncertainty: openUncertainty,
    },
    closeRange: null,
  };

  // For CLOSE: uncertainty is from lastSeenAt to disappearedAt
  if (state.disappearedAt) {
    const closeEarliest = state.lastSeenAt;
    const closeLatest = state.disappearedAt;
    const closeUncertainty =
      (closeLatest.getTime() - closeEarliest.getTime()) / 1000; // seconds

    result.closeRange = {
      earliest: closeEarliest,
      latest: closeLatest,
      uncertainty: closeUncertainty,
    };
  }

  return result;
}
