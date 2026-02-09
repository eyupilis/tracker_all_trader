const LEAD_ID = '4734249513132666368';

const endpoints = [
  // Latest Records / Trade Records endpoints
  { name: 'lead-trade-record-POST', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/latest-trade-record', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  { name: 'trade-activity-POST', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/trade-activity', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  { name: 'latest-trade', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/latest-trade', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  { name: 'order-record', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/order-record', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  // v2 variants  
  { name: 'position-history-v2-friendly', url: 'https://www.binance.com/bapi/futures/v2/friendly/future/copy-trade/lead-portfolio/position-history', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 5 } },
  // Try the "Latest Records" which shows individual fills
  { name: 'fill-orders', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-data/fill-orders', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  { name: 'lead-trade-history-friendly', url: 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/trade-history', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  { name: 'active-order', url: 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/active-order', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  // Maybe the order-history with different params shows "Latest Records"
  { name: 'order-history-public', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/order-history', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  { name: 'order-history-v2', url: 'https://www.binance.com/bapi/futures/v2/friendly/future/copy-trade/lead-portfolio/order-history', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  // Position activity 
  { name: 'position-activity', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/position-activity', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
  { name: 'lead-latest-records', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/latest-records', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 10 } },
];

(async () => {
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ep.body)
      });
      const data = await res.json();
      const ok = data.success !== false;
      let info = 'no-data';
      if (data.data) {
        if (Array.isArray(data.data)) info = 'array[' + data.data.length + ']';
        else if (data.data.list) info = 'list[' + data.data.list.length + '] total=' + data.data.total;
        else info = Object.keys(data.data).join(',');
      }
      const status = ok ? '✅' : '❌';
      console.log(status + ' ' + ep.name + ': HTTP' + res.status + ' => ' + info);
      if (ok && data.data) {
        const items = data.data.list || (Array.isArray(data.data) ? data.data : null);
        if (items && items[0]) {
          console.log('  FIELDS: ' + Object.keys(items[0]).join(', '));
          console.log('  SAMPLE: ' + JSON.stringify(items[0]).slice(0, 400));
        }
      }
    } catch(e) {
      console.log('❌ ' + ep.name + ': ERR ' + e.message);
    }
  }
})();
