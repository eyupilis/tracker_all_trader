import { prisma } from '../src/db/prisma.js';

async function main() {
  const traders = ['4790469828689935617', '4881409414442024961', '3753031993319956224'];
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

  console.log('Checking ZKUSDT traders:');
  console.log(`Cutoff time (24h): ${cutoffTime.toISOString()}\n`);

  for (const leadId of traders) {
    const latest = await prisma.rawIngest.findFirst({
      where: { leadId },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true, leadId: true, id: true }
    });

    const lt = await prisma.leadTrader.findUnique({
      where: { id: leadId },
      select: { nickname: true, positionShow: true }
    });

    const within24h = latest && latest.fetchedAt >= cutoffTime;

    console.log(`${lt?.nickname}:`);
    console.log(`  leadId: ${leadId}`);
    console.log(`  positionShow: ${lt?.positionShow}`);
    console.log(`  latest ingest: ${latest?.fetchedAt?.toISOString() || 'NONE'}`);
    console.log(`  within 24h: ${within24h}`);
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
