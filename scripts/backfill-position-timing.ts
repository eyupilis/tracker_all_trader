/**
 * Backfill script to link existing PositionState records to Events
 * and update estimatedOpenTime with accurate Event timestamps
 */

import { prisma } from '../src/db/prisma.js';

async function main() {
  console.log('🔄 Backfilling PositionState timing data from Events...\n');

  // Get all ACTIVE positions
  const activePositions = await prisma.positionState.findMany({
    where: {
      status: 'ACTIVE',
      openEventId: null, // Only update positions without Event link
    },
  });

  console.log(`Found ${activePositions.length} active positions without Event links\n`);

  let updatedCount = 0;
  let linkedCount = 0;

  for (const pos of activePositions) {
    // Determine the OPEN event type
    const openEventType = pos.direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT';

    // Search for matching OPEN event (within 5 minutes before firstSeenAt)
    const fiveMinutesBefore = new Date(pos.firstSeenAt.getTime() - 5 * 60 * 1000);

    const matchingEvent = await prisma.event.findFirst({
      where: {
        platform: pos.platform,
        leadId: pos.leadId,
        symbol: pos.symbol,
        eventType: openEventType,
        eventTime: {
          gte: fiveMinutesBefore,
          lte: pos.firstSeenAt,
        },
      },
      orderBy: {
        eventTime: 'desc',
      },
    });

    if (matchingEvent && matchingEvent.eventTime) {
      // Update position with Event timing
      await prisma.positionState.update({
        where: { id: pos.id },
        data: {
          estimatedOpenTime: matchingEvent.eventTime,
          openEventId: matchingEvent.id,
        },
      });

      linkedCount++;
      console.log(
        `✅ Linked ${pos.leadId.slice(0, 8)}... ${pos.symbol} ${pos.direction} → Event ${matchingEvent.eventTime.toISOString()}`
      );
    } else {
      // No Event found - set estimatedOpenTime to firstSeenAt (conservative)
      await prisma.positionState.update({
        where: { id: pos.id },
        data: {
          estimatedOpenTime: pos.firstSeenAt,
        },
      });

      updatedCount++;
    }
  }

  console.log(`\n✅ Backfill complete:`);
  console.log(`   - ${linkedCount} positions linked to Events (accurate timing)`);
  console.log(`   - ${updatedCount} positions updated with conservative timing`);
}

main()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });
