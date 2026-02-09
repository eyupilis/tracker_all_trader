import { prisma } from '../src/db/prisma.js';

async function main() {
  const traders = ['4790469828689935617', '4881409414442024961', '3753031993319956224'];

  console.log('Checking ZKUSDT order history:\n');

  for (const leadId of traders) {
    const latest = await prisma.rawIngest.findFirst({
      where: { leadId },
      orderBy: { fetchedAt: 'desc' },
      select: { payload: true }
    });

    const lt = await prisma.leadTrader.findUnique({
      where: { id: leadId },
      select: { nickname: true }
    });

    const payload = latest?.payload as any;
    const orders = payload?.orderHistory?.allOrders || [];
    const zkOrders = orders.filter((o: any) => String(o.symbol).toUpperCase() === 'ZKUSDT');

    console.log(`${lt?.nickname}:`);
    console.log(`  Total orders: ${orders.length}`);
    console.log(`  ZKUSDT orders: ${zkOrders.length}`);

    if (zkOrders.length > 0) {
      const recentOrders = zkOrders.slice(0, 3).map((o: any) => ({
        symbol: o.symbol,
        orderType: o.orderType,
        orderSide: o.orderSide,
        executedQty: o.executedQty,
        time: o.time
      }));
      console.log(`  Recent ZKUSDT orders:`, JSON.stringify(recentOrders, null, 2));
    }
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
