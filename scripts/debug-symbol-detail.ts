import { prisma } from '../src/db/prisma.js';

// Copy helper functions from the endpoint
function resolveSegment(positionShow: boolean | null): 'VISIBLE' | 'HIDDEN' | 'UNKNOWN' {
  if (positionShow === true) return 'VISIBLE';
  if (positionShow === false) return 'HIDDEN';
  return 'UNKNOWN';
}

function shouldIncludeSegment(
  traderSegment: 'VISIBLE' | 'HIDDEN' | 'UNKNOWN',
  filter: 'BOTH' | 'VISIBLE' | 'HIDDEN'
): boolean {
  if (filter === 'BOTH') return traderSegment !== 'UNKNOWN';
  return traderSegment === filter;
}

function deriveHiddenStatesFromOrders(
  orders: any[],
  cutoffMs: number
): Map<string, { side: 'LONG' | 'SHORT' | null; confidence: number; entryPrice: number; notional: number; lastAction: string | null }> {
  const map = new Map();
  // Simplified - just check if orders exist
  const symbols = new Set(orders.map((o: any) => String(o.symbol).toUpperCase()));
  for (const symbol of symbols) {
    map.set(symbol, {
      side: 'SHORT', // Assume SHORT for testing
      confidence: 0.85,
      entryPrice: 0.02,
      notional: 1000,
      lastAction: 'OPEN_SHORT'
    });
  }
  return map;
}

async function main() {
  const symbol = 'ZKUSDT';
  const timeRange = '24h';
  const segment = 'BOTH';

  const timeRangeMs = 24 * 60 * 60 * 1000;
  const cutoffTime = new Date(Date.now() - timeRangeMs);
  const cutoffMs = cutoffTime.getTime();
  const targetSymbol = symbol.toUpperCase();

  console.log(`Debugging /signals/symbol/${symbol}`);
  console.log(`Cutoff: ${cutoffTime.toISOString()}\n`);

  // Get latest ingests
  const latestIngests = await prisma.$queryRaw<Array<{ id: string; leadId: string; payload: any }>>`
    SELECT DISTINCT ON ("leadId") id, "leadId", payload
    FROM "RawIngest"
    WHERE "fetchedAt" >= ${cutoffTime}
    ORDER BY "leadId", "fetchedAt" DESC
  `;

  console.log(`Total ingests: ${latestIngests.length}\n`);

  // Batch fetch
  const leadIds = latestIngests.map(i => i.leadId);
  const [leadTraders, traderScores] = await Promise.all([
    prisma.leadTrader.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, positionShow: true, nickname: true },
    }),
    prisma.traderScore.findMany({
      where: { leadId: { in: leadIds } },
      select: {
        leadId: true,
        traderWeight: true,
      },
    }),
  ]);

  const ltMap = new Map(leadTraders.map(t => [t.id, t]));
  const scoreMap = new Map(traderScores.map(s => [s.leadId, s]));

  let processedCount = 0;
  let includedCount = 0;
  let hiddenProcessedCount = 0;

  for (const ingest of latestIngests) {
    if (!ingest.payload) continue;

    const payload = ingest.payload;
    const orders = payload.orderHistory?.allOrders || [];
    const lt = ltMap.get(ingest.leadId);
    const traderSegment = resolveSegment(lt?.positionShow ?? null);
    const shouldInclude = shouldIncludeSegment(traderSegment, segment as any);

    processedCount++;

    if (!shouldInclude) {
      console.log(`Skipped ${lt?.nickname}: segment=${traderSegment}, filter=${segment}`);
      continue;
    }

    includedCount++;

    // Check if this trader has ZKUSDT in orders
    const zkOrders = orders.filter((o: any) => String(o.symbol).toUpperCase() === targetSymbol);

    if (traderSegment === 'HIDDEN' && zkOrders.length > 0) {
      const hiddenStates = deriveHiddenStatesFromOrders(orders, cutoffMs);
      const derived = hiddenStates.get(targetSymbol);
      if (derived && derived.side) {
        hiddenProcessedCount++;
        console.log(`✅ HIDDEN trader ${lt?.nickname}: ${zkOrders.length} ZKUSDT orders, derived side=${derived.side}`);
      } else {
        console.log(`❌ HIDDEN trader ${lt?.nickname}: ${zkOrders.length} ZKUSDT orders, but NO derived state`);
      }
    } else if (traderSegment === 'VISIBLE') {
      console.log(`📊 VISIBLE trader ${lt?.nickname}: activePositions check needed`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Processed: ${processedCount}`);
  console.log(`  Included (after filter): ${includedCount}`);
  console.log(`  Hidden traders with ZKUSDT: ${hiddenProcessedCount}`);

  await prisma.$disconnect();
}

main().catch(console.error);
