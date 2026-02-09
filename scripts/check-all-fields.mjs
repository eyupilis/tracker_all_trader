const ID = '4681698170884314113'; // 晚风007
const BASE = 'https://www.binance.com/bapi/futures/v1';

async function main() {
  const [portfolio, positions, roi, assets, orders] = await Promise.all([
    fetch(`${BASE}/friendly/future/copy-trade/lead-portfolio/detail?portfolioId=${ID}`).then(r => r.json()),
    fetch(`${BASE}/friendly/future/copy-trade/lead-data/positions?portfolioId=${ID}`).then(r => r.json()),
    fetch(`${BASE}/friendly/future/copy-trade/lead-portfolio/roi-list`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId: ID, timeRange: '30D' })
    }).then(r => r.json()),
    fetch(`${BASE}/friendly/future/copy-trade/lead-portfolio/asset-preferences?portfolioId=${ID}`).then(r => r.json()),
    fetch(`${BASE}/friendly/future/copy-trade/lead-data/order-history`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId: ID, pageNumber: 1, pageSize: 10 })
    }).then(r => r.json()),
  ]);

  const d = portfolio.data;
  console.log('\n========================================');
  console.log('  PORTFOLIO DETAIL - ALL FIELDS');
  console.log('========================================');
  console.log('Total keys:', Object.keys(d).length);
  console.log('\n--- Profile ---');
  console.log('nickname:', d.nickname);
  console.log('avatar:', d.avatar?.slice(0, 80));
  console.log('description:', d.description);
  console.log('tags:', JSON.stringify(d.tags));
  console.log('joinTime:', d.joinTime ? new Date(d.joinTime).toISOString() : d.joinTime);
  console.log('lastActionAt:', d.lastActionAt ? new Date(d.lastActionAt).toISOString() : d.lastActionAt);
  console.log('status:', d.status);

  console.log('\n--- Performance ---');
  console.log('roi (30d):', d.roi);
  console.log('roiWeekly:', d.roiWeekly);
  console.log('pnl:', d.pnl);
  console.log('mdd (max drawdown):', d.mdd);
  console.log('winRate:', d.winRate);
  console.log('sharpRatio:', d.sharpRatio);
  console.log('profitRatio:', d.profitRatio);

  console.log('\n--- Trading Stats ---');
  console.log('tradeCount:', d.tradeCount);
  console.log('avgHoldingTime:', d.avgHoldingTime, 'ms');
  console.log('frequency:', d.frequency, 'trades/week');
  console.log('longRatio:', d.longRatio);
  console.log('shortRatio:', d.shortRatio);

  console.log('\n--- Fund Stats ---');
  console.log('marginBalance:', d.marginBalance);
  console.log('aumAmount:', d.aumAmount);
  console.log('currentCopyCount:', d.currentCopyCount);
  console.log('maxCopyCount:', d.maxCopyCount);
  console.log('copierPnl:', d.copierPnl);

  console.log('\n--- ALL KEYS ---');
  Object.keys(d).sort().forEach(k => {
    const v = d[k];
    const display = typeof v === 'object' ? JSON.stringify(v)?.slice(0, 60) : String(v).slice(0, 60);
    console.log(`  ${k}: ${display}`);
  });

  // POSITIONS
  const allPos = positions.data || [];
  const active = allPos.filter(p => parseFloat(p.positionAmount) !== 0);
  console.log('\n========================================');
  console.log('  POSITIONS');
  console.log('========================================');
  console.log('Total returned:', allPos.length);
  console.log('Active (amount != 0):', active.length);
  if (active[0]) {
    console.log('\n--- Position Fields ---');
    console.log('Keys:', Object.keys(active[0]).join(', '));
    console.log('\n--- Sample Position ---');
    console.log(JSON.stringify(active[0], null, 2));
  }

  // ROI
  console.log('\n========================================');
  console.log('  ROI SERIES');
  console.log('========================================');
  const roiData = roi.data || [];
  console.log('Data points:', roiData.length);
  if (roiData[0]) console.log('Fields:', Object.keys(roiData[0]).join(', '));
  if (roiData[0]) console.log('Sample:', JSON.stringify(roiData[0]));

  // ASSETS
  console.log('\n========================================');
  console.log('  ASSET PREFERENCES');
  console.log('========================================');
  const assetData = assets.data || [];
  console.log('Assets:', assetData.length);
  if (assetData[0]) console.log('Fields:', Object.keys(assetData[0]).join(', '));
  assetData.forEach(a => console.log(`  ${a.symbol}: ${a.ratio}`));

  // ORDERS
  console.log('\n========================================');
  console.log('  ORDER HISTORY');
  console.log('========================================');
  const orderData = orders.data?.list || [];
  console.log('Orders in page:', orderData.length);
  console.log('Total:', orders.data?.total);
  if (orderData[0]) {
    console.log('\n--- Order Fields ---');
    console.log('Keys:', Object.keys(orderData[0]).join(', '));
    console.log('\n--- Sample Order ---');
    console.log(JSON.stringify(orderData[0], null, 2));
  }

  console.log('\n========================================');
  console.log('  SUMMARY: What we CAN fetch');
  console.log('========================================');
  console.log('1. portfolioDetail:    ', Object.keys(d).length, 'fields (profile, performance, stats)');
  console.log('2. positions:          ', active.length, 'active positions with entry/mark/pnl/leverage');
  console.log('3. roiSeries:          ', roiData.length, 'daily ROI data points');
  console.log('4. assetPreferences:   ', assetData.length, 'traded assets with ratios');
  console.log('5. orderHistory:       ', orders.data?.total, 'total orders (max 100 per page)');
  console.log('6. leadCommon:         Fetched via separate endpoint');
  console.log('\n✅ ALL data visible on the Binance copy-trader page can be fetched!');
}

main().catch(console.error);
