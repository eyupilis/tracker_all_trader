import { prisma } from '../src/db/prisma.js';

async function main() {
  const traders = [
    { id: '4790469828689935617', name: 'bberry_777' },
    { id: '3753031993319956224', name: '0xjuly' },
    { id: '4881409414442024961', name: '金鳞-李佛魔' }
  ];

  console.log('Checking PositionState records for ZKUSDT:\n');

  for (const trader of traders) {
    const posState = await prisma.positionState.findFirst({
      where: {
        leadId: trader.id,
        symbol: 'ZKUSDT',
        status: 'ACTIVE'
      },
      select: {
        id: true,
        direction: true,
        firstSeenAt: true,
        estimatedOpenTime: true,
        entryPrice: true,
        openEventId: true,
        amount: true,
        leverage: true
      }
    });

    console.log(`${trader.name}:`);
    if (posState) {
      console.log(`  ✅ HAS PositionState`);
      console.log(`  direction: ${posState.direction}`);
      console.log(`  amount: ${posState.amount}`);
      console.log(`  leverage: ${posState.leverage}`);
      console.log(`  entryPrice: ${posState.entryPrice}`);
      console.log(`  openEventId: ${posState.openEventId || 'null'}`);
    } else {
      console.log(`  ❌ NO PositionState`);
    }
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
