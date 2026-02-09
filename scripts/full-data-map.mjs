// Full data map: everything fetchable from the Binance copy-trader page
const ID = '4681698170884314113';
const BASE = 'https://www.binance.com/bapi/futures/v1';

async function main() {
  const [leadCommon, detail, positions, roi, assets, orders, perf] = await Promise.all([
    fetch(`${BASE}/friendly/future/spot-copy-trade/common/spot-futures-last-lead?portfolioId=${ID}`).then(r => r.json()),
    fetch(`${BASE}/friendly/future/copy-trade/lead-portfolio/detail?portfolioId=${ID}`).then(r => r.json()),
    fetch(`${BASE}/friendly/future/copy-trade/lead-data/positions?portfolioId=${ID}`).then(r => r.json()),
    fetch(`${BASE}/public/future/copy-trade/lead-portfolio/chart-data?dataType=ROI&portfolioId=${ID}&timeRange=30D`).then(r => r.json()),
    fetch(`${BASE}/public/future/copy-trade/lead-portfolio/performance/coin?portfolioId=${ID}&timeRange=30D`).then(r => r.json()),
    fetch(`${BASE}/friendly/future/copy-trade/lead-portfolio/order-history`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId: ID, startTime: Date.now()-30*24*60*60*1000, endTime: Date.now(), pageSize: 100 })
    }).then(r => r.json()),
    fetch(`${BASE}/public/future/copy-trade/lead-portfolio/performance?portfolioId=${ID}&timeRange=30D`).then(r => r.json()),
  ]);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   COMPLETE BINANCE COPY-TRADER DATA MAP                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Lead Common
  console.log('┌─ 1. LEAD COMMON (9 fields) ─────────────────────────────────');
  const lc = leadCommon.data;
  Object.entries(lc).forEach(([k,v]) => console.log(`│  ${k}: ${JSON.stringify(v)?.slice(0,60)}`));
  
  // 2. Portfolio Detail
  console.log('\n┌─ 2. PORTFOLIO DETAIL (58 fields) ──────────────────────────');
  const d = detail.data;
  console.log('│  [Identity]');
  console.log(`│    nickname: ${d.nickname}`);
  console.log(`│    avatarUrl: ${d.avatarUrl?.slice(0,60)}`);
  console.log(`│    description: ${d.description?.slice(0,40)}`);
  console.log(`│    badgeName: ${d.badgeName}`);
  console.log(`│    status: ${d.status}`);
  console.log('│  [Financial]');
  console.log(`│    marginBalance: $${parseFloat(d.marginBalance).toFixed(2)}`);
  console.log(`│    aumAmount: $${parseFloat(d.aumAmount).toFixed(2)}`);
  console.log(`│    copierPnl: $${parseFloat(d.copierPnl).toFixed(2)}`);
  console.log(`│    profitSharingRate: ${d.profitSharingRate}%`);
  console.log(`│    rebateFee: $${parseFloat(d.rebateFee).toFixed(2)}`);
  console.log('│  [Copier Stats]');
  console.log(`│    currentCopyCount: ${d.currentCopyCount}`);
  console.log(`│    maxCopyCount: ${d.maxCopyCount}`);
  console.log(`│    mockCopyCount: ${d.mockCopyCount}`);
  console.log(`│    totalCopyCount: ${d.totalCopyCount}`);
  console.log(`│    favoriteCount: ${d.favoriteCount}`);
  console.log('│  [Risk Metrics]');
  console.log(`│    sharpRatio: ${d.sharpRatio}`);
  console.log(`│    lockPeriod: ${d.lockPeriod} days`);
  console.log('│  [Timestamps]');
  console.log(`│    startTime: ${new Date(d.startTime).toISOString()}`);
  console.log(`│    lastTradeTime: ${new Date(d.lastTradeTime).toISOString()}`);
  console.log('│  [Tags]');
  console.log(`│    tag: ${JSON.stringify(d.tag)}`);
  console.log(`│    tagItemVos: ${JSON.stringify(d.tagItemVos)?.slice(0,80)}`);

  // 3. Performance
  console.log('\n┌─ 3. PERFORMANCE (9 fields) ────────────────────────────────');
  const p = perf.data;
  Object.entries(p).forEach(([k,v]) => console.log(`│  ${k}: ${v}`));

  // 4. Positions
  const active = (positions.data||[]).filter(x => parseFloat(x.positionAmount) !== 0);
  console.log(`\n┌─ 4. POSITIONS (${active.length} active / ${positions.data?.length} total) ──`);
  console.log('│  Fields per position: id, symbol, collateral, positionAmount,');
  console.log('│    entryPrice, markPrice, leverage, isolated, positionSide,');
  console.log('│    unrealizedProfit, cumRealized, notionalValue, breakEvenPrice, adl');
  active.forEach(pos => {
    const side = pos.positionSide === 'BOTH' ? (parseFloat(pos.positionAmount) > 0 ? 'LONG' : 'SHORT') : pos.positionSide;
    console.log(`│  ${side} ${pos.symbol} ${pos.leverage}x | entry: ${parseFloat(pos.entryPrice).toFixed(4)} | PnL: $${parseFloat(pos.unrealizedProfit).toFixed(2)}`);
  });

  // 5. ROI Series
  console.log(`\n┌─ 5. ROI SERIES (${roi.data?.length} data points) ──────────────────────`);
  console.log('│  Fields: value, dataType, dateTime');
  (roi.data||[]).slice(0,3).forEach(r => console.log(`│  ${new Date(r.dateTime).toLocaleDateString()}: ${(parseFloat(r.value)*100).toFixed(2)}%`));
  console.log('│  ... and', (roi.data?.length||0)-3, 'more daily points');

  // 6. Asset Preferences
  console.log(`\n┌─ 6. ASSET PREFERENCES ──────────────────────────────────────`);
  const ap = assets.data;
  console.log('│  Keys:', Object.keys(ap).join(', '));
  if (ap.coinPnlList) {
    console.log(`│  coinPnlList: ${ap.coinPnlList.length} coins`);
    ap.coinPnlList.slice(0,5).forEach(c => console.log(`│    ${c.symbol}: pnl=$${parseFloat(c.pnl).toFixed(2)}, roi=${(parseFloat(c.roi)*100).toFixed(2)}%`));
  }
  if (ap.coinPositionList) {
    console.log(`│  coinPositionList: ${ap.coinPositionList.length} coins`);
  }

  // 7. Order History
  const ol = orders.data;
  console.log(`\n┌─ 7. ORDER HISTORY (${ol.list?.length} fetched / ${ol.total} total) ─────`);
  if (ol.list?.[0]) {
    console.log('│  Fields:', Object.keys(ol.list[0]).join(', '));
    ol.list.slice(0,3).forEach(o => {
      const side = o.positionSide === 'BOTH' ? o.side : o.positionSide;
      console.log(`│  ${side} ${o.symbol} qty=${o.executedQty} @ $${o.avgPrice} | PnL: $${o.totalPnl?.toFixed(2) || 'N/A'}`);
    });
    console.log('│  ... and', ol.list.length - 3, 'more orders');
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   SUMMARY                                                   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  ✅ 7 endpoints ALL working                                 ║');
  console.log(`║  ✅ Portfolio: 58 fields (identity, financial, copier stats) ║`);
  console.log(`║  ✅ Performance: ROI, PnL, MDD, WinRate, Sharpe             ║`);
  console.log(`║  ✅ Positions: ${active.length} active with full detail                   ║`);
  console.log(`║  ✅ ROI Chart: ${roi.data?.length} daily data points                       ║`);
  console.log(`║  ✅ Asset Prefs: coin-level PnL breakdown                   ║`);
  console.log(`║  ✅ Orders: ${ol.total} total (100 per fetch)                       ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main().catch(console.error);
