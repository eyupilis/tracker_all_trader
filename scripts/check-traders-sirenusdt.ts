import { prisma } from '../src/db/prisma.js';

async function main() {
  // Find traders by nickname
  const traders = await prisma.leadTrader.findMany({
    where: {
      nickname: {
        in: ['都柏林碎碎念', '阿慧儿'],
      },
    },
    select: {
      id: true,
      nickname: true,
    },
  });

  console.log('Found traders:');
  console.log(JSON.stringify(traders, null, 2));

  // Check their SIRENUSDT positions
  for (const trader of traders) {
    const positions = await prisma.positionState.findMany({
      where: {
        leadId: trader.id,
        symbol: 'SIRENUSDT',
        status: 'ACTIVE',
      },
    });

    console.log(`\n${trader.nickname} (${trader.id}):`);
    console.log(`  SIRENUSDT positions: ${positions.length}`);
    if (positions.length > 0) {
      console.log(JSON.stringify(positions, null, 2));
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
