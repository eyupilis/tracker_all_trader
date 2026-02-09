// Test the EXACT endpoints from the scraper service
const ID = '4681698170884314113';
const BASE = 'https://www.binance.com/bapi/futures/v1';

const ENDPOINTS = {
  leadCommon: `${BASE}/friendly/future/spot-copy-trade/common/spot-futures-last-lead?portfolioId=${ID}`,
  portfolioDetail: `${BASE}/friendly/future/copy-trade/lead-portfolio/detail?portfolioId=${ID}`,
  positions: `${BASE}/friendly/future/copy-trade/lead-data/positions?portfolioId=${ID}`,
  roiSeries: `${BASE}/public/future/copy-trade/lead-portfolio/chart-data?dataType=ROI&portfolioId=${ID}&timeRange=30D`,
  assetPreferences: `${BASE}/public/future/copy-trade/lead-portfolio/performance/coin?portfolioId=${ID}&timeRange=30D`,
  orderHistory: `${BASE}/friendly/future/copy-trade/lead-portfolio/order-history`,
  performance: `${BASE}/public/future/copy-trade/lead-portfolio/performance?portfolioId=${ID}&timeRange=30D`,
};

async function main() {
  console.log('Testing exact scraper endpoint URLs...\n');

  for (const [name, url] of Object.entries(ENDPOINTS)) {
    const isPost = name === 'orderHistory';
    const opts = {
      method: isPost ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    if (isPost) {
      opts.body = JSON.stringify({
        portfolioId: ID,
        startTime: Date.now() - 30*24*60*60*1000,
        endTime: Date.now(),
        pageSize: 5,
      });
    }

    try {
      const resp = await fetch(url, opts);
      const json = await resp.json();
      
      let dataInfo = 'null';
      if (json.data) {
        if (Array.isArray(json.data)) {
          dataInfo = `Array(${json.data.length})`;
          if (json.data[0]) dataInfo += ` keys: ${Object.keys(json.data[0]).join(', ')}`;
        } else if (typeof json.data === 'object') {
          const keys = Object.keys(json.data);
          dataInfo = `Object(${keys.length} keys)`;
          if (json.data.list) dataInfo += ` → list: ${json.data.list.length}, total: ${json.data.total}`;
        }
      }

      const status = json.success === true ? '✅' : '❌';
      console.log(`${status} ${name}`);
      console.log(`   URL: ...${url.split('v1')[1]}`);
      console.log(`   HTTP: ${resp.status} | success: ${json.success} | data: ${dataInfo}`);
      if (!json.success && json.message) console.log(`   Error: ${json.message}`);
      console.log();
    } catch(e) {
      console.log(`❌ ${name}: ${e.message}\n`);
    }
  }
}

main().catch(console.error);
