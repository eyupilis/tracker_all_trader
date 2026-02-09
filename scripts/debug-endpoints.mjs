const ID = '4681698170884314113';
const BASE = 'https://www.binance.com/bapi/futures/v1';

async function main() {
  // Test each endpoint and show raw response shape
  const endpoints = [
    {
      name: 'leadCommon',
      url: `${BASE}/friendly/future/copy-trade/lead-portfolio/common?portfolioId=${ID}`,
      method: 'GET'
    },
    {
      name: 'portfolioDetail',
      url: `${BASE}/friendly/future/copy-trade/lead-portfolio/detail?portfolioId=${ID}`,
      method: 'GET'
    },
    {
      name: 'positions',
      url: `${BASE}/friendly/future/copy-trade/lead-data/positions?portfolioId=${ID}`,
      method: 'GET'
    },
    {
      name: 'roiSeries',
      url: `${BASE}/friendly/future/copy-trade/lead-portfolio/roi-list`,
      method: 'POST',
      body: { portfolioId: ID, timeRange: '30D' }
    },
    {
      name: 'assetPreferences',
      url: `${BASE}/friendly/future/copy-trade/lead-portfolio/asset-preferences?portfolioId=${ID}`,
      method: 'GET'
    },
    {
      name: 'orderHistory',
      url: `${BASE}/friendly/future/copy-trade/lead-data/order-history`,
      method: 'POST',
      body: { portfolioId: ID, pageNumber: 1, pageSize: 10 }
    },
  ];

  for (const ep of endpoints) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${ep.name} (${ep.method} ${ep.url.split('?')[0].split('/').slice(-2).join('/')})`);
    console.log(`${'='.repeat(60)}`);

    const opts = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
    if (ep.body) opts.body = JSON.stringify(ep.body);

    const resp = await fetch(ep.url, opts);
    const json = await resp.json();

    console.log('HTTP:', resp.status);
    console.log('success:', json.success);
    console.log('code:', json.code);
    console.log('message:', json.message);

    if (json.data === null || json.data === undefined) {
      console.log('data: NULL/UNDEFINED');
      console.log('Full response:', JSON.stringify(json, null, 2).slice(0, 500));
    } else if (Array.isArray(json.data)) {
      console.log('data: Array with', json.data.length, 'items');
      if (json.data[0]) console.log('First item keys:', Object.keys(json.data[0]).join(', '));
      if (json.data[0]) console.log('First item:', JSON.stringify(json.data[0]).slice(0, 200));
    } else if (typeof json.data === 'object') {
      const keys = Object.keys(json.data);
      console.log('data: Object with', keys.length, 'keys');
      console.log('Keys:', keys.join(', '));
      // For order history, check nested structure
      if (json.data.list) {
        console.log('  data.list:', json.data.list.length, 'items');
        console.log('  data.total:', json.data.total);
        if (json.data.list[0]) console.log('  First order:', JSON.stringify(json.data.list[0]).slice(0, 200));
      }
    }
  }

  // Also try the performance and stats endpoints from the scraper
  console.log(`\n${'='.repeat(60)}`);
  console.log('  CHECKING ALTERNATE ENDPOINT PATHS');
  console.log(`${'='.repeat(60)}`);

  const altEndpoints = [
    `${BASE}/public/future/copy-trade/lead-portfolio/performance?portfolioId=${ID}&timeRange=30D`,
    `${BASE}/public/future/copy-trade/lead-portfolio/detail?portfolioId=${ID}`,
    `${BASE}/public/future/copy-trade/lead-data/positions?portfolioId=${ID}`,
  ];

  for (const url of altEndpoints) {
    const resp = await fetch(url);
    const json = await resp.json();
    const path = url.split('?')[0].split('/').slice(-3).join('/');
    console.log(`\n${path}: ${resp.status} | success=${json.success} | code=${json.code}`);
    if (json.data) {
      if (Array.isArray(json.data)) console.log('  Array:', json.data.length, 'items');
      else console.log('  Object:', Object.keys(json.data).length, 'keys →', Object.keys(json.data).slice(0, 10).join(', '));
    }
  }
}

main().catch(console.error);
