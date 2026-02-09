import { prisma } from '../src/db/prisma.js';

async function main() {
  const ingest = await prisma.rawIngest.findFirst({
    where: {
      payload: {
        path: ['orderHistory', 'allOrders'],
        array_contains: [{}]
      }
    },
    orderBy: { fetchedAt: 'desc' }
  });

  if (!ingest) {
    console.log('No ingest found with orderHistory');
    return;
  }

  const payload = ingest.payload as any;
  const orders = payload?.orderHistory?.allOrders || [];

  if (orders.length > 0) {
    const sampleOrder = orders[0];
    console.log('Order fields:', Object.keys(sampleOrder));
    console.log('\nSample order:');
    console.log(JSON.stringify(sampleOrder, null, 2));
  } else {
    console.log('No orders found in payload');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
