import { prisma } from '../src/db/prisma.js';

async function main() {
  const total = await prisma.positionState.count();
  const active = await prisma.positionState.count({ where: { status: 'ACTIVE' } });
  const withEvents = await prisma.positionState.count({ where: { openEventId: { not: null } } });
  const withEstimated = await prisma.positionState.count({ where: { estimatedOpenTime: { not: null } } });

  console.log('PositionState Statistics:');
  console.log(`  Total records: ${total}`);
  console.log(`  Active: ${active}`);
  console.log(`  With openEventId: ${withEvents}`);
  console.log(`  With estimatedOpenTime: ${withEstimated}`);

  await prisma.$disconnect();
}

main().catch(console.error);
