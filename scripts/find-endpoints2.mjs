const ID = '4681698170884314113';

async function tryMore() {
  // Try various v2/v3 combinations and different base paths
  const bases = [
    'https://www.binance.com/bapi/futures/v1',
    'https://www.binance.com/bapi/futures/v2', 
    'https://www.binance.com/bapi/futures/v3',
    'https://www.binance.com/bapi/copy-trade/v1',
    'https://www.binance.com/bapi/copy-trading/v1',
  ];
  
  const subpaths = ['public', 'friendly', 'private'];
  
  const endpoints = [
    { suffix: '/future/copy-trade/lead-portfolio/roi-list', method: 'POST', body: { portfolioId: ID, timeRange: '30D' } },
    { suffix: '/future/copy-trade/lead-portfolio/asset-preferences', method: 'GET', qs: `portfolioId=${ID}` },
    { suffix: '/future/copy-trade/lead-data/order-history', method: 'POST', body: { portfolioId: ID, pageNumber: 1, pageSize: 5 } },
    // try without "future"
    { suffix: '/copy-trade/lead-portfolio/roi-list', method: 'POST', body: { portfolioId: ID, timeRange: '30D' } },
    { suffix: '/copy-trade/lead-portfolio/asset-preferences', method: 'GET', qs: `portfolioId=${ID}` },
    { suffix: '/copy-trade/lead-data/order-history', method: 'POST', body: { portfolioId: ID, pageNumber: 1, pageSize: 5 } },
    // try direct (no public/friendly)
    { suffix: '/lead-portfolio/roi-list', method: 'POST', body: { portfolioId: ID, timeRange: '30D' }, noSubpath: true },
    { suffix: '/lead-portfolio/asset-preferences', method: 'GET', qs: `portfolioId=${ID}`, noSubpath: true },
    { suffix: '/lead-data/order-history', method: 'POST', body: { portfolioId: ID, pageNumber: 1, pageSize: 5 }, noSubpath: true },
  ];

  let found = 0;
  for (const base of bases) {
    for (const sub of subpaths) {
      for (const ep of endpoints) {
        const url = ep.noSubpath
          ? `${base}${ep.suffix}${ep.qs ? '?' + ep.qs : ''}`
          : `${base}/${sub}${ep.suffix}${ep.qs ? '?' + ep.qs : ''}`;
          
        const opts = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
        if (ep.body) opts.body = JSON.stringify(ep.body);

        try {
          const resp = await fetch(url, opts);
          if (resp.status === 200) {
            const json = await resp.json();
            if (json.success === true && json.data) {
              found++;
              const dataType = Array.isArray(json.data) ? `Array(${json.data.length})` : `Object(${Object.keys(json.data).length})`;
              console.log(`✅ FOUND: ${url.replace('https://www.binance.com/bapi/', '')} → ${dataType}`);
              if (Array.isArray(json.data) && json.data[0]) {
                console.log('   Keys:', Object.keys(json.data[0]).join(', '));
              } else if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
                console.log('   Keys:', Object.keys(json.data).join(', '));
              }
            }
          }
        } catch(e) { /* skip */ }
      }
    }
  }
  
  if (found === 0) {
    console.log('No working endpoints found. These may now require authentication or cookies.');
    console.log('\nLet me check what the scraper was using...');
  }

  // Also try the exact URLs from the scraper
  console.log('\n--- Checking scraper endpoints ---');
  const scraperBase = 'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade';
  const scraperEndpoints = [
    { name: 'detail', url: `${scraperBase}/lead-portfolio/detail?portfolioId=${ID}` },
    { name: 'positions', url: `${scraperBase}/lead-data/positions?portfolioId=${ID}` },
    { name: 'performance', url: `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance?portfolioId=${ID}&timeRange=30D` },
  ];
  
  for (const ep of scraperEndpoints) {
    const resp = await fetch(ep.url);
    const json = await resp.json();
    console.log(`${json.success ? '✅' : '❌'} ${ep.name}: ${json.success ? 'OK' : json.message || resp.status}`);
  }

  // Let me try with specific headers that mimic browser
  console.log('\n--- Trying with browser-like headers ---');
  const browserHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://www.binance.com',
    'Referer': 'https://www.binance.com/en/copy-trading/lead-details/' + ID,
  };

  const retryEndpoints = [
    { name: 'roi-list (friendly)', url: `${scraperBase}/lead-portfolio/roi-list`, method: 'POST', body: { portfolioId: ID, timeRange: '30D' } },
    { name: 'asset-prefs (friendly)', url: `${scraperBase}/lead-portfolio/asset-preferences?portfolioId=${ID}`, method: 'GET' },
    { name: 'orders (friendly)', url: `${scraperBase}/lead-data/order-history`, method: 'POST', body: { portfolioId: ID, pageNumber: 1, pageSize: 5 } },
    { name: 'roi-list (public)', url: `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/roi-list`, method: 'POST', body: { portfolioId: ID, timeRange: '30D' } },
    { name: 'asset-prefs (public)', url: `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/asset-preferences?portfolioId=${ID}`, method: 'GET' },
    { name: 'orders (public)', url: `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-data/order-history`, method: 'POST', body: { portfolioId: ID, pageNumber: 1, pageSize: 5 } },
  ];

  for (const ep of retryEndpoints) {
    const opts = { method: ep.method, headers: browserHeaders };
    if (ep.body) opts.body = JSON.stringify(ep.body);
    try {
      const resp = await fetch(ep.url, opts);
      const json = await resp.json();
      if (json.success) {
        const dataInfo = Array.isArray(json.data) ? `Array(${json.data.length})` : json.data ? `Object(${Object.keys(json.data).length})` : 'null';
        console.log(`✅ ${ep.name} → ${dataInfo}`);
      } else {
        console.log(`❌ ${ep.name} → ${resp.status} ${json.code || ''} ${json.message || ''}`);
      }
    } catch(e) {
      console.log(`❌ ${ep.name} → ERROR: ${e.message}`);
    }
  }
}

tryMore().catch(console.error);
