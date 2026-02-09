#!/usr/bin/env node
// Quick test: fetch all 6 Binance endpoints for multiple traders

const LEAD_IDS = [
  '4734249513132666368', // Falcon-Hamsters
  '4681698170884314113', // 晚风007
  '4778647677431223297', // Galaxy Bot 3
];

const TIME_RANGE = '30D';
const PAGE_SIZE = 10;

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

async function fetchTrader(leadId) {
  const now = Date.now();
  const startTime = now - 30 * 24 * 60 * 60 * 1000;
  const t0 = performance.now();

  const [leadCommon, portfolioDetail, positions, roiSeries, assetPreferences, orderHistory] =
    await Promise.all([
      fetchJson(`https://www.binance.com/bapi/futures/v1/friendly/future/spot-copy-trade/common/spot-futures-last-lead?portfolioId=${leadId}`),
      fetchJson(`https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/detail?portfolioId=${leadId}`),
      fetchJson(`https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/positions?portfolioId=${leadId}`),
      fetchJson(`https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/chart-data?dataType=ROI&portfolioId=${leadId}&timeRange=${TIME_RANGE}`),
      fetchJson(`https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance/coin?portfolioId=${leadId}&timeRange=${TIME_RANGE}`),
      fetchJson('https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history', {
        method: 'POST',
        body: JSON.stringify({ portfolioId: leadId, startTime, endTime: now, pageSize: PAGE_SIZE }),
      }),
    ]);

  const elapsed = (performance.now() - t0).toFixed(0);

  const allPositions = positions.data || [];
  const activePositions = allPositions.filter(p => {
    const amt = parseFloat(p.positionAmount) || 0;
    const notional = parseFloat(p.notionalValue) || 0;
    const pnl = parseFloat(p.unrealizedProfit) || 0;
    return amt !== 0 || notional !== 0 || pnl !== 0;
  });

  return {
    leadId,
    elapsed: `${elapsed}ms`,
    nickname: portfolioDetail.data?.nickname || '?',
    status: portfolioDetail.data?.status || '?',
    leadCommon: {
      success: leadCommon.success,
      fields: Object.keys(leadCommon.data || {}),
    },
    portfolioDetail: {
      success: portfolioDetail.success,
      fields: Object.keys(portfolioDetail.data || {}).length,
      nickname: portfolioDetail.data?.nickname,
      marginBalance: portfolioDetail.data?.marginBalance,
      aumAmount: portfolioDetail.data?.aumAmount,
      currentCopyCount: portfolioDetail.data?.currentCopyCount,
      sharpRatio: portfolioDetail.data?.sharpRatio,
    },
    positions: {
      success: positions.success,
      rawCount: allPositions.length,
      activeCount: activePositions.length,
      active: activePositions.map(p => ({
        symbol: p.symbol,
        side: p.positionSide,
        amount: p.positionAmount,
        leverage: p.leverage,
        pnl: p.unrealizedProfit,
      })),
    },
    roiSeries: {
      success: roiSeries.success,
      points: (roiSeries.data || []).length,
      latest: (roiSeries.data || []).slice(-1)[0] || null,
    },
    assetPreferences: {
      success: assetPreferences.success,
      assets: (assetPreferences.data?.data || []).length,
      top3: (assetPreferences.data?.data || []).slice(0, 3).map(a => a.asset),
    },
    orderHistory: {
      success: orderHistory.success,
      total: orderHistory.data?.total || 0,
      pageLoaded: (orderHistory.data?.list || []).length,
      hasMore: !!orderHistory.data?.indexValue,
    },
  };
}

async function main() {
  console.log(`\n🔍 Testing ${LEAD_IDS.length} traders in PARALLEL...\n`);

  const t0 = performance.now();
  const results = await Promise.all(LEAD_IDS.map(fetchTrader));
  const totalMs = (performance.now() - t0).toFixed(0);

  for (const r of results) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 ${r.nickname} (${r.leadId}) — ${r.status}`);
    console.log(`   Fetched in ${r.elapsed}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`   ✅ Lead Common:      ${r.leadCommon.fields.length} fields`);
    console.log(`   ✅ Portfolio Detail:  ${r.portfolioDetail.fields} fields | balance=${r.portfolioDetail.marginBalance} | AUM=${r.portfolioDetail.aumAmount} | copiers=${r.portfolioDetail.currentCopyCount} | sharpe=${r.portfolioDetail.sharpRatio}`);
    console.log(`   ✅ Positions:        ${r.positions.rawCount} raw → ${r.positions.activeCount} active`);
    for (const p of r.positions.active) {
      console.log(`      📌 ${p.symbol} ${p.side} amount=${p.amount} lev=${p.leverage}x pnl=${p.pnl}`);
    }
    console.log(`   ✅ ROI Series:       ${r.roiSeries.points} points | latest=${r.roiSeries.latest?.value ?? '-'}`);
    console.log(`   ✅ Asset Preferences: ${r.assetPreferences.assets} assets | top3=${r.assetPreferences.top3.join(', ')}`);
    console.log(`   ✅ Order History:    ${r.orderHistory.total} total | page=${r.orderHistory.pageLoaded} | hasMore=${r.orderHistory.hasMore}`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`⚡ ALL ${results.length} traders fetched in ${totalMs}ms total (parallel)`);
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(console.error);
