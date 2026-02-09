const LEAD_ID = '4734249513132666368';

(async () => {
  // Get position history with more data to understand "Latest Records"
  const res = await fetch('https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/position-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolioId: LEAD_ID, pageNumber: 1, pageSize: 15 })
  });
  const data = await res.json();
  console.log('Total records:', data.data.total);
  console.log('Fields:', Object.keys(data.data.list[0]).join(', '));
  console.log('\n--- All records ---');
  for (const item of data.data.list.slice(0, 15)) {
    const opened = new Date(item.opened).toISOString();
    const closed = new Date(item.closed).toISOString();
    console.log(`${item.side} ${item.symbol} | status=${item.status} | cost=${item.avgCost} close=${item.avgClosePrice} | pnl=${item.closingPnl} | qty=${item.maxOpenInterest} vol=${item.closedVolume} | margin=${item.isolated} | ${opened} -> ${closed}`);
  }
  
  // Also check — the screenshot has "Open Long / Close Short" — this maps to side + action
  // position-history shows completed positions. The screenshot's "Latest Records" tab
  // is actually more like individual trade entries (each open/close is separate)
  // Let's check if order-history has this info with better params
  console.log('\n\n--- Order History with more data ---');
  const res2 = await fetch('https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolioId: LEAD_ID, pageNumber: 1, pageSize: 15 })
  });
  const data2 = await res2.json();
  console.log('Total orders:', data2.data.total);
  for (const item of data2.data.list.slice(0, 15)) {
    const time = new Date(item.orderTime).toISOString();
    const total = (item.executedQty * item.avgPrice).toFixed(2);
    console.log(`${time} | ${item.side} ${item.type} ${item.symbol} | qty=${item.executedQty} @ ${item.avgPrice} = $${total} | pnl=${item.totalPnl} | positionSide=${item.positionSide}`);
  }
  
  // Let's also try to check lead-portfolio with encryptedUid param which some endpoints need
  console.log('\n\n--- Trying with ETHUSDT trader (from screenshot) ---');
  const LEAD2 = '4897589091850209025';
  const res3 = await fetch('https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolioId: LEAD2, pageNumber: 1, pageSize: 10 })
  });
  const data3 = await res3.json();
  console.log('Total orders:', data3.data?.total);
  if (data3.data?.list) {
    for (const item of data3.data.list.slice(0, 10)) {
      const time = new Date(item.orderTime).toISOString();
      const total = (item.executedQty * item.avgPrice).toFixed(2);
      console.log(`${time} | ${item.side} ${item.type} ${item.symbol} | qty=${item.executedQty} @ ${item.avgPrice} = $${total} | pnl=${item.totalPnl} | posSide=${item.positionSide}`);
    }
  }
})();
