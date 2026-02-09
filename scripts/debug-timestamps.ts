import { prisma } from '../src/db/prisma.js';

async function main() {
  const timeRangeMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const cutoffMs = now - timeRangeMs;

  console.log(`Now: ${now} (${new Date(now).toISOString()})`);
  console.log(`Cutoff (24h ago): ${cutoffMs} (${new Date(cutoffMs).toISOString()})\n`);

  const timestamps = [
    { trader: 'bberry_777', ts: 1770322929796 },
    { trader: '0xjuly (oldest)', ts: 1770210494810 },
    { trader: '0xjuly (newest)', ts: 1770337233826 },
    { trader: '金鳞-李佛魔', ts: 1770406316728 },
  ];

  for (const item of timestamps) {
    const isWithinCutoff = item.ts >= cutoffMs;
    const date = new Date(item.ts);
    console.log(`${item.trader}:`);
    console.log(`  Timestamp: ${item.ts}`);
    console.log(`  Date: ${date.toISOString()}`);
    console.log(`  Within cutoff: ${isWithinCutoff}`);
    console.log(`  Age: ${((now - item.ts) / 1000 / 60 / 60).toFixed(2)} hours`);
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
