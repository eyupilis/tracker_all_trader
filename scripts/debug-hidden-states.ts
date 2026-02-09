import { prisma } from '../src/db/prisma.js';

// Copy the actual function from signals.ts
function getOrderActionNormalized(side: string, positionSide: string): string {
  const s = (side || '').toUpperCase();
  const ps = (positionSide || '').toUpperCase();

  if (ps === 'LONG' || ps === 'BUY') {
    return s === 'BUY' ? 'OPEN_LONG' : 'CLOSE_LONG';
  }
  if (ps === 'SHORT' || ps === 'SELL') {
    return s === 'SELL' ? 'OPEN_SHORT' : 'CLOSE_SHORT';
  }

  if (s === 'BUY') return 'OPEN_LONG';
  if (s === 'SELL') return 'OPEN_SHORT';
  return 'UNKNOWN';
}

interface DerivedSymbolState {
  symbol: string;
  side: 'LONG' | 'SHORT' | null;
  entryPrice: number;
  notional: number;
  confidence: number;
  lastAction: string | null;
  lastEventTime: number;
}

function deriveHiddenStatesFromOrders(
  orders: any[],
  cutoffMs: number,
): Map<string, DerivedSymbolState> {
  const bySymbol = new Map<string, any[]>();
  for (const order of orders || []) {
    const symbol = String(order?.symbol || '').toUpperCase();
    const ts = Number(order?.orderTime || 0);
    if (!symbol || !ts) continue;
    if (cutoffMs !== 0 && ts < cutoffMs) continue;
    const list = bySymbol.get(symbol) || [];
    list.push(order);
    bySymbol.set(symbol, list);
  }

  const states = new Map<string, DerivedSymbolState>();
  for (const [symbol, symbolOrders] of bySymbol) {
    const sorted = [...symbolOrders].sort((a, b) => Number(a.orderTime || 0) - Number(b.orderTime || 0));
    let side: 'LONG' | 'SHORT' | null = null;
    let entryPrice = 0;
    let notional = 0;
    let supportEvents = 0;
    let contradictionEvents = 0;
    let closeWithoutOpen = 0;
    let lastAction: string | null = null;
    let lastEventTime = 0;

    for (const order of sorted) {
      const action = getOrderActionNormalized(String(order?.side || ''), String(order?.positionSide || ''));
      const qty = parseFloat(String(order?.executedQty || '0'));
      const avgPrice = parseFloat(String(order?.avgPrice || '0'));
      const orderNotional = Math.abs(qty * avgPrice);
      const ts = Number(order?.orderTime || 0);
      if (ts > lastEventTime) lastEventTime = ts;
      lastAction = action;

      if (action === 'OPEN_LONG') {
        if (side === 'SHORT') contradictionEvents++;
        side = 'LONG';
        entryPrice = avgPrice || entryPrice;
        notional = orderNotional || notional;
        supportEvents++;
        continue;
      }
      if (action === 'OPEN_SHORT') {
        if (side === 'LONG') contradictionEvents++;
        side = 'SHORT';
        entryPrice = avgPrice || entryPrice;
        notional = orderNotional || notional;
        supportEvents++;
        continue;
      }
      if (action === 'CLOSE_LONG') {
        if (side === 'LONG') {
          side = null;
        } else {
          closeWithoutOpen++;
        }
        continue;
      }
      if (action === 'CLOSE_SHORT') {
        if (side === 'SHORT') {
          side = null;
        } else {
          closeWithoutOpen++;
        }
        continue;
      }
    }

    if (!side) continue;

    let confidence = 0.55;
    confidence += Math.min(supportEvents, 3) * 0.08;
    confidence -= Math.min(contradictionEvents, 2) * 0.12;
    confidence -= Math.min(closeWithoutOpen, 2) * 0.1;
    if (lastAction === 'OPEN_LONG' || lastAction === 'OPEN_SHORT') confidence += 0.08;
    const ageMs = lastEventTime > 0 ? Date.now() - lastEventTime : Number.MAX_SAFE_INTEGER;
    if (ageMs <= 60 * 60 * 1000) confidence += 0.12;
    else if (ageMs <= 24 * 60 * 60 * 1000) confidence += 0.06;
    else if (ageMs > 7 * 24 * 60 * 60 * 1000) confidence -= 0.1;
    confidence = Math.min(0.95, Math.max(0.2, confidence));

    states.set(symbol, {
      symbol,
      side,
      entryPrice,
      notional,
      confidence,
      lastAction,
      lastEventTime,
    });
  }

  return states;
}

async function main() {
  const traders = [
    { id: '4790469828689935617', name: 'bberry_777' },
    { id: '3753031993319956224', name: '0xjuly' },
    { id: '4881409414442024961', name: '金鳞-李佛魔' }
  ];

  const timeRangeMs = 24 * 60 * 60 * 1000;
  const cutoffMs = Date.now() - timeRangeMs;

  for (const trader of traders) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Trader: ${trader.name} (${trader.id})`);
    console.log('='.repeat(60));

    const ingest = await prisma.rawIngest.findFirst({
      where: { leadId: trader.id },
      orderBy: { fetchedAt: 'desc' },
      select: { payload: true }
    });

    const payload = ingest?.payload as any;
    const orders = payload?.orderHistory?.allOrders || [];

    console.log(`Total orders: ${orders.length}`);

    // Get ZKUSDT orders
    const zkOrders = orders.filter((o: any) => String(o.symbol).toUpperCase() === 'ZKUSDT');
    console.log(`ZKUSDT orders: ${zkOrders.length}\n`);

    if (zkOrders.length > 0) {
      console.log('Order details:');
      for (const order of zkOrders) {
        const action = getOrderActionNormalized(order.side, order.positionSide);
        console.log(`  - ${action}: qty=${order.executedQty}, price=${order.avgPrice}, time=${order.orderTime}`);
      }
    }

    // Derive hidden states
    const hiddenStates = deriveHiddenStatesFromOrders(orders, cutoffMs);
    const zkState = hiddenStates.get('ZKUSDT');

    console.log(`\nDerived ZKUSDT state:`);
    if (zkState) {
      console.log(`  ✅ side: ${zkState.side}`);
      console.log(`  entryPrice: ${zkState.entryPrice}`);
      console.log(`  confidence: ${zkState.confidence}`);
      console.log(`  lastAction: ${zkState.lastAction}`);
    } else {
      console.log(`  ❌ NO STATE (position likely closed or doesn't meet criteria)`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
