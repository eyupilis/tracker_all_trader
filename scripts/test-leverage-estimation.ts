import { estimateLeverageForHiddenTrader } from '../src/services/leverageEstimation.js';
import { prisma } from '../src/db/prisma.js';

async function main() {
  // Test with traders from XRPUSDT
  const traders = [
    { name: 'Sky株式会社', id: '4532994172262753536' },
    { name: 'Peedee-Sealed', id: '4627938648819109120' },
    { name: '自由的肥龟', id: '4842069554616809729' },
  ];

  console.log('Testing Leverage Estimation:\n');

  for (const trader of traders) {
    // Check if trader exists
    const lt = await prisma.leadTrader.findUnique({
      where: { id: trader.id },
      select: { nickname: true, positionShow: true }
    });

    if (!lt) {
      console.log(`${trader.name}: NOT FOUND in database`);
      continue;
    }

    const estimate = await estimateLeverageForHiddenTrader(trader.id);

    console.log(`${lt.nickname}:`);
    console.log(`  positionShow: ${lt.positionShow}`);
    console.log(`  Estimated Leverage: ${estimate.estimatedLeverage}x`);
    console.log(`  Method: ${estimate.method}`);
    console.log(`  Confidence: ${estimate.confidence}`);
    console.log(`  Sample Size: ${estimate.sampleSize}`);
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
