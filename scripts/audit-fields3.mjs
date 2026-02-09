const LEAD_ID = '4734249513132666368';

async function go() {
  // 1. ROI chart data
  const res1 = await fetch('https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/chart-data?portfolioId=' + LEAD_ID + '&timeRange=30D');
  const j1 = await res1.json();
  console.log('=== ROI CHART DATA ===');
  console.log('success:', j1.success, '| points:', j1.data ? j1.data.length : 0);
  if (j1.data && j1.data.length > 0) {
    console.log('fields:', Object.keys(j1.data[0]).sort().join(', '));
    console.log('sample:', JSON.stringify(j1.data[0]));
    console.log('range:', new Date(j1.data[0].dateTime).toISOString().slice(0,10), '→', new Date(j1.data[j1.data.length-1].dateTime).toISOString().slice(0,10));
  }

  // 2. Order history
  const res2 = await fetch('https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history?portfolioId=' + LEAD_ID + '&pageNumber=1&pageSize=5');
  const j2 = await res2.json();
  console.log('\n=== ORDER HISTORY ===');
  console.log('success:', j2.success, '| total:', j2.data ? j2.data.total : 0);
  if (j2.data && j2.data.allOrders && j2.data.allOrders.length > 0) {
    console.log('fields:', Object.keys(j2.data.allOrders[0]).sort().join(', '));
    console.log('sample:', JSON.stringify(j2.data.allOrders[0]));
  }

  // 3. Positions (filter active)
  const res3 = await fetch('https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/positions?portfolioId=' + LEAD_ID);
  const j3 = await res3.json();
  const all = j3.data || [];
  const active = all.filter(p => parseFloat(p.positionAmount) !== 0);
  console.log('\n=== POSITIONS ===');
  console.log('success:', j3.success, '| raw:', all.length, '| active:', active.length);
  if (active.length > 0) {
    console.log('fields:', Object.keys(active[0]).sort().join(', '));
    active.forEach((p, i) => {
      console.log('  [' + i + '] ' + p.symbol + ' ' + p.positionSide + ' amt=' + p.positionAmount + ' lev=' + p.leverage + 'x entry=' + p.entryPrice + ' mark=' + p.markPrice + ' pnl=' + p.unrealizedProfit + ' notional=' + p.notionalValue + ' adl=' + p.adl + ' liq=' + p.breakEvenPrice + ' isolated=' + p.isolated + ' isoWallet=' + p.isolatedWallet);
    });
  }

  // 4. Asset preferences with coinPnlList structure
  const res4 = await fetch('https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance/coin?portfolioId=' + LEAD_ID + '&timeRange=30D');
  const j4 = await res4.json();
  console.log('\n=== ASSET PREFERENCES ===');
  console.log('success:', j4.success);
  if (j4.data) {
    console.log('top-level keys:', Object.keys(j4.data).sort().join(', '));
    // Old format: data array with {asset, volume}
    if (j4.data.data) {
      console.log('OLD FORMAT - data array:', j4.data.data.length, 'items');
      j4.data.data.forEach((d, i) => console.log('  [' + i + ']', JSON.stringify(d)));
    }
    // New format: coinPnlList with detailed per-coin PnL
    if (j4.data.coinPnlList) {
      console.log('NEW FORMAT - coinPnlList:', j4.data.coinPnlList.length, 'items');
      console.log('fields:', Object.keys(j4.data.coinPnlList[0]).sort().join(', '));
      j4.data.coinPnlList.forEach((c, i) => console.log('  [' + i + ']', JSON.stringify(c)));
    }
  }

  // 5. Performance across all timeRanges
  console.log('\n=== PERFORMANCE (all timeRanges) ===');
  for (const tr of ['7D', '30D', '90D']) {
    const res = await fetch('https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance?portfolioId=' + LEAD_ID + '&timeRange=' + tr);
    const j = await res.json();
    if (j.success && j.data) {
      console.log(tr + ':', JSON.stringify(j.data));
    }
  }

  // 6. Lead Common
  const res6 = await fetch('https://www.binance.com/bapi/futures/v1/friendly/future/spot-copy-trade/common/spot-futures-last-lead?portfolioId=' + LEAD_ID);
  const j6 = await res6.json();
  console.log('\n=== LEAD COMMON ===');
  console.log('success:', j6.success, '| fields:', j6.data ? Object.keys(j6.data).length : 0);
  if (j6.data) console.log(JSON.stringify(j6.data));
}

go().catch(console.error);
