/**
 * FAZ 0 Backfill Script
 *
 * One-time script to populate the new FAZ 0 fields for existing traders:
 *   - LeadTrader.positionShow, nickname, posShowUpdatedAt
 *   - TraderScore.qualityScore, confidence, winRate, sampleSize, traderWeight
 *
 * Usage: npx tsx scripts/backfill-faz0.ts
 */

import { prisma } from '../src/db/prisma.js';
import { updateTraderWeight } from '../src/services/traderWeight.js';

async function main() {
  console.log('=== FAZ 0 Backfill ===\n');

  // 1. Get all traders
  const traders = await prisma.leadTrader.findMany();
  console.log(`Found ${traders.length} traders to backfill.\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const trader of traders) {
    const leadId = trader.id;

    // 2. Get latest raw ingest
    const latestIngest = await prisma.rawIngest.findFirst({
      where: { leadId },
      orderBy: { fetchedAt: 'desc' },
    });

    if (!latestIngest) {
      console.log(`  [SKIP] ${leadId} — no raw ingest data`);
      skipCount++;
      continue;
    }

    try {
      const payload = latestIngest.payload as Record<string, any>;
      const portfolioDetail = payload?.portfolioDetail;

      // 3. Extract and persist positionShow + nickname
      const positionShow = typeof portfolioDetail?.positionShow === 'boolean'
        ? portfolioDetail.positionShow
        : null;
      const nickname = typeof portfolioDetail?.nickname === 'string'
        ? portfolioDetail.nickname
        : null;

      await prisma.leadTrader.update({
        where: { id: leadId },
        data: {
          positionShow,
          nickname,
          posShowUpdatedAt: new Date(),
        },
      });

      // 4. Compute and persist metrics + weight
      const weight = await updateTraderWeight(leadId, 'binance');

      const segment = positionShow === true ? 'VISIBLE' : positionShow === false ? 'HIDDEN' : 'UNKNOWN';
      console.log(`  [OK] ${nickname || leadId} — segment=${segment}, weight=${weight?.toFixed(4) ?? 'null'}`);
      successCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [ERR] ${leadId} — ${msg}`);
      errorCount++;
    }
  }

  console.log(`\n=== Backfill Complete ===`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`  Errors:  ${errorCount}`);

  // 5. Verification query
  console.log('\n=== Verification ===');

  const results = await prisma.$queryRaw<Array<{
    id: string;
    nickname: string | null;
    positionShow: boolean | null;
    qualityScore: number | null;
    winRate: number | null;
    traderWeight: number | null;
  }>>`
    SELECT
      lt.id,
      lt.nickname,
      lt."positionShow",
      ts."qualityScore",
      ts."winRate",
      ts."traderWeight"
    FROM "LeadTrader" lt
    LEFT JOIN "TraderScore" ts ON ts."leadId" = lt.id
    ORDER BY ts."traderWeight" DESC NULLS LAST
  `;

  console.log('\n  LeadId (last 6)  | Nickname           | Segment  | QS  | WR    | Weight');
  console.log('  ' + '-'.repeat(80));
  for (const r of results) {
    const segment = r.positionShow === true ? 'VISIBLE' : r.positionShow === false ? 'HIDDEN' : 'UNKNOWN';
    const nick = (r.nickname || '').padEnd(18).slice(0, 18);
    const qs = r.qualityScore !== null ? String(r.qualityScore).padStart(3) : '  -';
    const wr = r.winRate !== null ? (r.winRate * 100).toFixed(0).padStart(3) + '%' : '   -';
    const wt = r.traderWeight !== null ? r.traderWeight.toFixed(4) : '     -';
    console.log(`  ...${r.id.slice(-6)}          | ${nick} | ${segment.padEnd(8)} | ${qs} | ${wr}  | ${wt}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
