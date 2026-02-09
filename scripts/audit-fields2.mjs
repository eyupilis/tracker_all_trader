const LEAD_ID = '4897589091850209025';

async function go() {
  // ROI Series
  let res = await fetch('https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/chart-data?portfolioId='+LEAD_ID+'&timeRange=30D');
  let j = await res.json();
  console.log('ROI chart-data:', j.success, j.data ? 'items='+j.data.length : j.message);
  if (j.data && j.data.length > 0) {
    console.log('  sample:', JSON.stringify(j.data[0]));
    console.log('  fields:', Object.keys(j.data[0]).join(', '));
  }

  // Order History
  res = await fetch('https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history?portfolioId='+LEAD_ID+'&pageNumber=1&pageSize=5');
  j = await res.json();
  console.log('\nOrder history:', j.success, j.data ? 'total='+j.data.total : j.message);
  if (j.data && j.data.allOrders && j.data.allOrders.length > 0) {
    console.log('  fields:', Object.keys(j.data.allOrders[0]).sort().join(', '));
    console.log('  sample:', JSON.stringify(j.data.allOrders[0]));
  }

  // Positions
  res = await fetch('https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/positions?portfolioId='+LEAD_ID);
  j = await res.json();
  console.log('\nPositions:', j.success, j.data ? 'count='+j.data.length : j.message);
  if (j.data && j.data.length > 0) {
    console.log('  fields:', Object.keys(j.data[0]).sort().join(', '));
    console.log('  sample:', JSON.stringify(j.data[0]));
  }

  // Asset preferences
  res = await fetch('https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance/coin?portfolioId='+LEAD_ID+'&timeRange=30D');
  j = await res.json();
  console.log('\nAsset pref:', j.success);
  if (j.data) {
    console.log('  keys:', Object.keys(j.data).join(', '));
    if (j.data.data) {
      console.log('  data items:', j.data.data.length);
      if (j.data.data.length > 0) console.log('  data sample:', JSON.stringify(j.data.data[0]));
    }
    if (j.data.coinPnlList) {
      console.log('  coinPnlList:', j.data.coinPnlList.length);
      if (j.data.coinPnlList.length > 0) {
        console.log('  coinPnlList fields:', Object.keys(j.data.coinPnlList[0]).sort().join(', '));
        j.data.coinPnlList.slice(0,3).forEach((c, i) => console.log('    ['+i+']', JSON.stringify(c)));
      }
    }
  }

  // Performance - also check different timeRanges
  for (const tr of ['7D', '30D', '90D']) {
    res = await fetch('https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance?portfolioId='+LEAD_ID+'&timeRange='+tr);
    j = await res.json();
    if (j.success && j.data) {
      console.log('\nPerformance '+tr+':', JSON.stringify(j.data));
    }
  }
}
go();
