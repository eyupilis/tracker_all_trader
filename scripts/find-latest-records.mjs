const LEAD_ID = '4734249513132666368';

const endpoints = [
  { name: 'position-history-friendly', url: 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/position-history', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 5 } },
  { name: 'position-history-public', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/position-history', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 5 } },
  { name: 'trade-history', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-data/trade-history', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 5 } },
  { name: 'trade-record', url: 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/trade-record', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 5 } },
  { name: 'latest-record', url: 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/latest-record', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 5 } },
  { name: 'trade-records', url: 'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/trade-records', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 5 } },
  { name: 'position-history-v2', url: 'https://www.binance.com/bapi/futures/v2/public/future/copy-trade/lead-portfolio/position-history', method: 'POST', body: { portfolioId: LEAD_ID, pageNumber: 1, pageSize: 5 } },
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
        if (Array.isArray(data.data)) {
          info = 'array[' + data.data.length + ']';
        } else if (data.data.list) {
          info = 'list[' + data.data.list.length + '] total=' + data.data.total;
        } else {
          info = Object.keys(data.data).join(',');
        }
      }
      console.log(ep.name + ': HTTP' + res.status + ' ok=' + ok + ' => ' + info);
      if (ok && data.data) {
        const items = data.data.list || (Array.isArray(data.data) ? data.data : null);
        if (items && items[0]) {
          console.log('  FIELDS: ' + Object.keys(items[0]).join(', '));
          console.log('  SAMPLE: ' + JSON.stringify(items[0]).slice(0, 400));
        }
      }
    } catch(e) {
      console.log(ep.name + ': ERR ' + e.message);
    }
  }
})();
