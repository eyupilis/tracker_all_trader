const ID = '4681698170884314113';

async function tryEndpoints() {
  const prefixes = [
    'https://www.binance.com/bapi/futures/v1/public/future/copy-trade',
    'https://www.binance.com/bapi/futures/v2/public/future/copy-trade',
    'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade',
    'https://www.binance.com/bapi/futures/v2/friendly/future/copy-trade',
    'https://www.binance.com/bapi/futures/v3/public/future/copy-trade',
  ];

  const paths = [
    { path: '/lead-portfolio/roi-list', method: 'POST', body: { portfolioId: ID, timeRange: '30D' } },
    { path: '/lead-portfolio/asset-preferences', method: 'GET', qs: `portfolioId=${ID}` },
    { path: '/lead-data/order-history', method: 'POST', body: { portfolioId: ID, pageNumber: 1, pageSize: 5 } },
    { path: '/lead-portfolio/common', method: 'GET', qs: `portfolioId=${ID}` },
    { path: '/lead-portfolio/performance', method: 'GET', qs: `portfolioId=${ID}&timeRange=30D` },
    // try alternate names
    { path: '/lead-portfolio/roi', method: 'POST', body: { portfolioId: ID, timeRange: '30D' } },
    { path: '/lead-portfolio/roi', method: 'GET', qs: `portfolioId=${ID}&timeRange=30D` },
    { path: '/lead-portfolio/asset', method: 'GET', qs: `portfolioId=${ID}` },
    { path: '/lead-portfolio/assets', method: 'GET', qs: `portfolioId=${ID}` },
    { path: '/lead-data/orders', method: 'POST', body: { portfolioId: ID, pageNumber: 1, pageSize: 5 } },
    { path: '/lead-data/order', method: 'POST', body: { portfolioId: ID, pageNumber: 1, pageSize: 5 } },
  ];

  for (const ep of paths) {
    for (const prefix of prefixes) {
      const url = ep.qs
        ? `${prefix}${ep.path}?${ep.qs}`
        : `${prefix}${ep.path}`;

      const opts = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
      if (ep.body) opts.body = JSON.stringify(ep.body);

      try {
        const resp = await fetch(url, opts);
        const json = await resp.json();
        const shortPrefix = prefix.replace('https://www.binance.com/bapi/futures/', '');
        const status = json.success === true ? '✅' : resp.status === 404 ? '❌' : '⚠️';
        
        if (json.success === true) {
          const dataInfo = Array.isArray(json.data)
            ? `Array(${json.data.length})`
            : json.data && typeof json.data === 'object'
              ? `Object(${Object.keys(json.data).length} keys: ${Object.keys(json.data).slice(0, 5).join(', ')})`
              : String(json.data);
          console.log(`${status} ${shortPrefix}${ep.path} [${ep.method}] → ${dataInfo}`);
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

tryEndpoints().catch(console.error);
