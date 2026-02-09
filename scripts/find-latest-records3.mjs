const LEAD_ID = '4734249513132666368';

// The screenshot shows "Latest Records" tab with Open Long, Close Short etc.
// Let's check the existing order-history endpoint more closely + try GET variants
const tests = [
  // Existing order-history (already used) — does it have "Close Long" actions?
  { name: 'order-history-friendly-POST', url: 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history', method: 'POST', body: JSON.stringify({ portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 }) },
  // GET variant of order history
  { name: 'order-history-friendly-GET', url: `https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history?portfolioId=${LEAD_ID}&pageNumber=1&pageSize=10`, method: 'GET', body: null },
  // Position history = "Position History" tab (we found this)
  // But "Latest Records" tab is different — it shows individual trade fills
  // Try lead-portfolio/trade-fill or lead-data/latest
  { name: 'lead-data-order-history', url: 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/order-history', method: 'POST', body: JSON.stringify({ portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 }) },
  { name: 'lead-data-order-GET', url: `https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/order-history?portfolioId=${LEAD_ID}&pageNumber=1&pageSize=10`, method: 'GET', body: null },
  // Maybe v3
  { name: 'v3-order-history', url: 'https://www.binance.com/bapi/futures/v3/friendly/future/copy-trade/lead-portfolio/order-history', method: 'POST', body: JSON.stringify({ portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 }) },
  // Different body params — could use tradeType, side etc.
  { name: 'order-history-with-side', url: 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history', method: 'POST', body: JSON.stringify({ portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10, tradeType: 'ALL' }) },
];

(async () => {
  for (const t of tests) {
    try {
      const opts = { method: t.method, headers: { 'Content-Type': 'application/json' } };
      if (t.body) opts.body = t.body;
      const res = await fetch(t.url, opts);
      const data = await res.json();
      const ok = data.success !== false;
      let info = 'no-data';
      if (data.data) {
        if (Array.isArray(data.data)) info = 'array[' + data.data.length + ']';
        else if (data.data.list) info = 'list[' + data.data.list.length + '] total=' + data.data.total;
        else info = Object.keys(data.data).join(',');
      }
      console.log((ok ? '✅' : '❌') + ' ' + t.name + ': HTTP' + res.status + ' => ' + info);
      if (ok && data.data) {
        const items = data.data.list || (Array.isArray(data.data) ? data.data : null);
        if (items && items[0]) {
          console.log('  FIELDS: ' + Object.keys(items[0]).join(', '));
          console.log('  SAMPLE: ' + JSON.stringify(items[0]).slice(0, 500));
        }
      }
    } catch(e) {
      console.log('❌ ' + t.name + ': ERR ' + e.message);
    }
  }
  
  // Also let's see what data the existing order-history gives us in detail
  console.log('\n--- FULL order-history sample (existing endpoint) ---');
  const res = await fetch('https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolioId: LEAD_ID, pageNumber: 1, pageSize: 3 })
  });
  const data = await res.json();
  if (data.data && data.data.list) {
    for (const item of data.data.list) {
      console.log(JSON.stringify(item, null, 2));
    }
  }
})();
