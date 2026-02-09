/**
 * HIDDEN Trader Position State Tracking (Faz 1 + Faz 2)
 *
 * For HIDDEN traders (positionShow=false), we can't see activePositions.
 * Instead, we track their positions from orderHistory events (OPEN/CLOSE).
 *
 * This service:
 * 1. Creates PositionState records from OPEN events
 * 2. Closes PositionState records from CLOSE events
 * 3. Provides accurate timing data (from eventTime)
 */

import { prisma } from '../db/prisma.js';
import type { EventInput } from '../schemas/ingest.js';

interface HiddenPositionStateUpdate {
  newPositions: number;
  closedPositions: number;
}

/**
 * Track HIDDEN trader positions from orderHistory events
 *
 * @param leadId - Trader's leadId
 * @param events - Events from orderHistory
 * @param fetchedAt - Fetch timestamp
 * @returns Statistics about position state changes
 */
export async function trackHiddenPositionStates(
  leadId: string,
  events: EventInput[],
  fetchedAt: Date,
  platform: string = 'binance'
): Promise<HiddenPositionStateUpdate> {
  let newCount = 0;
  let closedCount = 0;

  // Filter for OPEN events
  const openEvents = events.filter(e =>
    e.eventType === 'OPEN_LONG' || e.eventType === 'OPEN_SHORT'
  );

  // Filter for CLOSE events
  const closeEvents = events.filter(e =>
    e.eventType === 'CLOSE_LONG' || e.eventType === 'CLOSE_SHORT'
  );

  // ================================================================
  // 1. Process OPEN events - Create new PositionState records
  // ================================================================
  for (const event of openEvents) {
    const direction = event.eventType === 'OPEN_LONG' ? 'LONG' : 'SHORT';
    // Use fetchedAt as timing reference (events already inserted with parsed time)
    const eventTime = fetchedAt;

    // Check if position already exists
    const existing = await prisma.positionState.findFirst({
      where: {
        platform,
        leadId,
        symbol: event.symbol,
        direction,
        status: 'ACTIVE',
      },
    });

    if (!existing) {
      // Create new PositionState from OPEN event
      await prisma.positionState.create({
        data: {
          platform,
          leadId,
          symbol: event.symbol,
          direction,
          status: 'ACTIVE',
          entryPrice: event.price ?? 0,
          amount: event.amount ?? 0,
          leverage: null, // Not available in orderHistory
          firstSeenAt: eventTime,
          lastSeenAt: eventTime,
          estimatedOpenTime: eventTime, // Use actual event time
          openEventId: event.event_key, // Link to Event record
        },
      });
      newCount++;
    } else {
      // Position already exists - just update lastSeenAt
      await prisma.positionState.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: fetchedAt,
        },
      });
    }
  }

  // ================================================================
  // 2. Process CLOSE events - Close PositionState records
  // ================================================================
  for (const event of closeEvents) {
    const direction = event.eventType === 'CLOSE_LONG' ? 'LONG' : 'SHORT';
    // Use fetchedAt as timing reference
    const eventTime = fetchedAt;

    // Find matching ACTIVE position
    const positions = await prisma.positionState.findMany({
      where: {
        platform,
        leadId,
        symbol: event.symbol,
        direction,
        status: 'ACTIVE',
      },
      orderBy: {
        firstSeenAt: 'desc', // Close the most recent one
      },
      take: 1,
    });

    if (positions.length > 0) {
      const position = positions[0];

      await prisma.positionState.update({
        where: { id: position.id },
        data: {
          status: 'CLOSED',
          disappearedAt: eventTime,
          estimatedCloseTime: eventTime, // Use actual event time
          closeEventId: event.event_key, // Link to Event record
        },
      });
      closedCount++;
    }
  }

  return {
    newPositions: newCount,
    closedPositions: closedCount,
  };
}

/**
 * Get active positions for a HIDDEN trader from PositionState
 * Sorted by estimated open time (most recent first)
 *
 * @param leadId - Trader's leadId
 * @param platform - Platform (default: binance)
 * @returns Active position states
 */
export async function getHiddenActivePositions(
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
 * Derive position states from Event table (for backwards compatibility)
 *
 * This is used when PositionState table is empty or for validation.
 *
 * @param leadId - Trader's leadId
 * @param cutoffTime - Only consider events after this time
 * @param platform - Platform (default: binance)
 * @returns Map of symbol -> derived position state
 */
export async function derivePositionsFromEvents(
  leadId: string,
  cutoffTime: Date,
  platform: string = 'binance'
): Promise<Map<string, DerivedPosition>> {
  // Get recent events for this trader
  const events = await prisma.event.findMany({
    where: {
      platform,
      leadId,
      eventTime: { gte: cutoffTime },
      eventType: {
        in: ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'],
      },
    },
    orderBy: {
      eventTime: 'asc', // Chronological order
    },
  });

  // State machine to track open positions
  const positions = new Map<string, DerivedPosition>();

  for (const event of events) {
    const key = `${event.symbol}`;

    if (event.eventType === 'OPEN_LONG' || event.eventType === 'OPEN_SHORT') {
      const direction = event.eventType === 'OPEN_LONG' ? 'LONG' : 'SHORT';

      positions.set(key, {
        symbol: event.symbol,
        direction,
        entryPrice: event.price ?? 0,
        amount: event.amount ?? 0,
        openedAt: event.eventTime || event.createdAt,
        confidence: 0.85, // High confidence - from Event table
        eventKey: event.eventKey,
      });
    }

    if (event.eventType === 'CLOSE_LONG' || event.eventType === 'CLOSE_SHORT') {
      // Remove position - it's closed
      positions.delete(key);
    }
  }

  return positions;
}

export interface DerivedPosition {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  amount: number;
  openedAt: Date;
  confidence: number;
  eventKey: string;
}
