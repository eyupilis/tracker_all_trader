#!/usr/bin/env node
// Audit ALL fields from every Binance endpoint for a given trader

const LEAD_ID = '4532994172262753536';

const endpoints = {
  portfolioDetail: `https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/detail?portfolioId=${LEAD_ID}`,
  leadCommon: `https://www.binance.com/bapi/futures/v1/friendly/future/spot-copy-trade/common/spot-futures-last-lead?portfolioId=${LEAD_ID}`,
  positions: `https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/positions?portfolioId=${LEAD_ID}`,
  performance: `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance?portfolioId=${LEAD_ID}&timeRange=30D`,
  roiSeries: `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/chart-data?portfolioId=${LEAD_ID}&timeRange=30D`,
  assetPreferences: `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance/coin?portfolioId=${LEAD_ID}&timeRange=30D`,
  orderHistory: `https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history?portfolioId=${LEAD_ID}&pageNumber=1&pageSize=20`,
};

async function fetchEndpoint(name, url) {
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) {
      console.log(`\n❌ ${name}: API returned success=false`);
      return null;
    }
    return json.data;
  } catch (e) {
    console.log(`\n❌ ${name}: ${e.message}`);
    return null;
  }
}

function printFields(obj, indent = '  ') {
  if (!obj) return;
  for (const [k, v] of Object.entries(obj).sort(([a],[b]) => a.localeCompare(b))) {
    let type = typeof v;
    let display = String(v);
    if (v === null) { type = 'null'; display = 'null'; }
    else if (Array.isArray(v)) { type = `array[${v.length}]`; display = v.length > 0 ? '(see below)' : '[]'; }
    else if (typeof v === 'object') { type = `object[${Object.keys(v).length}]`; display = '(see below)'; }
    else { display = String(v).slice(0, 80); }
    console.log(`${indent}${k}: ${type} = ${display}`);
  }
}

async function main() {
  console.log('🔍 COMPLETE BINANCE DATA FIELD AUDIT');
  console.log('='.repeat(60));
  console.log(`Lead ID: ${LEAD_ID}\n`);

  // 1. Portfolio Detail
  const portfolio = await fetchEndpoint('portfolioDetail', endpoints.portfolioDetail);
  if (portfolio) {
    console.log(`\n📋 PORTFOLIO DETAIL — ${Object.keys(portfolio).length} fields`);
    console.log('-'.repeat(50));
    printFields(portfolio);
    // Print tag details
    if (portfolio.tagItemVos) {
      console.log('\n  └─ tagItemVos items:');
      portfolio.tagItemVos.forEach((t, i) => {
        console.log(`     [${i}]:`, JSON.stringify(t));
      });
    }
  }

  // 2. Lead Common
  const leadCommon = await fetchEndpoint('leadCommon', endpoints.leadCommon);
  if (leadCommon) {
    console.log(`\n\n🔑 LEAD COMMON — ${Object.keys(leadCommon).length} fields`);
    console.log('-'.repeat(50));
    printFields(leadCommon);
  }

  // 3. Positions
  const positions = await fetchEndpoint('positions', endpoints.positions);
  if (positions) {
    console.log(`\n\n📊 POSITIONS — ${positions.length} active positions`);
    console.log('-'.repeat(50));
    if (positions.length > 0) {
      console.log(`  Fields per position: ${Object.keys(positions[0]).length}`);
      printFields(positions[0]);
      // Show all symbols
      console.log('\n  All positions:');
      positions.forEach((p, i) => {
        console.log(`    [${i}] ${p.symbol} ${p.positionSide || 'BOTH'} amt=${p.positionAmount} lev=${p.leverage}x entry=${p.entryPrice} pnl=${p.unrealizedProfit}`);
      });
    }
  }

  // 4. Performance
  const perf = await fetchEndpoint('performance', endpoints.performance);
  if (perf) {
    console.log(`\n\n📈 PERFORMANCE (30D) — ${Object.keys(perf).length} fields`);
    console.log('-'.repeat(50));
    printFields(perf);
  }

  // 5. ROI Series
  const roi = await fetchEndpoint('roiSeries', endpoints.roiSeries);
  if (roi) {
    console.log(`\n\n📉 ROI SERIES — ${roi.length} data points`);
    console.log('-'.repeat(50));
    if (roi.length > 0) {
      console.log(`  Fields per point: ${Object.keys(roi[0]).length}`);
      printFields(roi[0]);
      console.log(`  Date range: ${new Date(roi[0].dateTime).toISOString().slice(0,10)} → ${new Date(roi[roi.length-1].dateTime).toISOString().slice(0,10)}`);
      console.log(`  ROI range: ${Math.min(...roi.map(r=>r.value)).toFixed(2)}% → ${Math.max(...roi.map(r=>r.value)).toFixed(2)}%`);
    }
  }

  // 6. Asset Preferences
  const assets = await fetchEndpoint('assetPreferences', endpoints.assetPreferences);
  if (assets) {
    console.log(`\n\n🪙 ASSET PREFERENCES (30D) — ${Object.keys(assets).length} top-level fields`);
    console.log('-'.repeat(50));
    // Check structure
    if (assets.coinPnlList) {
      console.log(`  coinPnlList: ${assets.coinPnlList.length} coins`);
      if (assets.coinPnlList.length > 0) {
        console.log(`  Fields per coin:`);
        printFields(assets.coinPnlList[0], '    ');
        console.log('\n  All coins:');
        assets.coinPnlList.forEach((c, i) => {
          console.log(`    [${i}] ${c.coin || c.symbol}: pnl=${c.pnl} ratio=${c.ratio} tradeCount=${c.tradeCount}`);
        });
      }
    }
    // Print other top-level fields
    for (const [k, v] of Object.entries(assets)) {
      if (k !== 'coinPnlList') {
        console.log(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0,100) : v}`);
      }
    }
  }

  // 7. Order History
  const orders = await fetchEndpoint('orderHistory', endpoints.orderHistory);
  if (orders) {
    const orderList = orders.allOrders || orders.list || orders;
    const total = orders.total || (Array.isArray(orderList) ? orderList.length : 0);
    console.log(`\n\n📜 ORDER HISTORY — ${total} total orders (showing page 1)`);
    console.log('-'.repeat(50));
    const list = Array.isArray(orderList) ? orderList : [];
    if (list.length > 0) {
      console.log(`  Fields per order: ${Object.keys(list[0]).length}`);
      printFields(list[0]);
      console.log('\n  Sample orders (first 5):');
      list.slice(0, 5).forEach((o, i) => {
        console.log(`    [${i}] ${o.symbol} ${o.side} ${o.type} qty=${o.executedQty || o.origQty} price=${o.avgPrice || o.price} pnl=${o.realizedProfit || '-'} time=${new Date(o.time || o.updateTime).toISOString()}`);
      });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`  portfolioDetail: ${portfolio ? Object.keys(portfolio).length : 0} fields`);
  console.log(`  leadCommon:      ${leadCommon ? Object.keys(leadCommon).length : 0} fields`);
  console.log(`  positions:       ${positions ? positions.length : 0} active, ${positions && positions.length > 0 ? Object.keys(positions[0]).length : 0} fields each`);
  console.log(`  performance:     ${perf ? Object.keys(perf).length : 0} fields`);
  console.log(`  roiSeries:       ${roi ? roi.length : 0} data points, ${roi && roi.length > 0 ? Object.keys(roi[0]).length : 0} fields each`);
  console.log(`  assetPreferences:${assets ? (assets.coinPnlList ? ` ${assets.coinPnlList.length} coins` : ` ${Object.keys(assets).length} fields`) : ' 0'}`);
  const orderList2 = orders ? (orders.allOrders || orders.list || orders) : [];
  console.log(`  orderHistory:    ${orders ? orders.total || 0 : 0} total, ${Array.isArray(orderList2) && orderList2.length > 0 ? Object.keys(orderList2[0]).length : 0} fields each`);
}

main().catch(console.error);
