import { prisma } from '../src/db/prisma.js';

async function main() {
  const positions = await prisma.positionState.findMany({
    where: {
      symbol: 'SIRENUSDT',
      status: 'ACTIVE',
    },
    select: {
      leadId: true,
      direction: true,
      estimatedOpenTime: true,
      openEventId: true,
      firstSeenAt: true,
    },
  });

  console.log('SIRENUSDT Active Positions:', positions.length);
  console.log(JSON.stringify(positions, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
