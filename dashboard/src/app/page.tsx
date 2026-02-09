import { getLatestIngests, getTraderPerformance, getTraderPortfolio, getTraderPositions, RawIngest, PerformanceData, PortfolioDetail, Position } from '@/lib/api';
import Link from 'next/link';
import { TraderListCard } from '@/components/binance/TraderListCard';
import { StatBox } from '@/components/StatBox';
import { ActivityFeed } from '@/components/ActivityFeed';
import { EventHistoryChart } from '@/components/EventHistoryChart';

export const revalidate = 60;

interface TraderCardData {
  leadId: string;
  portfolio: PortfolioDetail | null;
  performance: PerformanceData | null;
  positions: Position[];
}

export default async function DashboardPage() {
  let ingests: RawIngest[] = [];
  let error: string | null = null;

  try {
    const response = await getLatestIngests(200);
    ingests = response.data;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch data';
  }

  // Get unique trader IDs
  const traderIds = [...new Set(ingests.map((i) => i.leadId))];

  // Fetch portfolio, performance, and positions for each trader in parallel
  const traderDataList: TraderCardData[] = [];
  try {
    const results = await Promise.allSettled(
      traderIds.map(async (leadId): Promise<TraderCardData> => {
        const [portfolio, performance, positions] = await Promise.all([
          getTraderPortfolio(leadId),
          getTraderPerformance(leadId),
          getTraderPositions(leadId),
        ]);
        return { leadId, portfolio, performance, positions };
      })
    );
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        traderDataList.push(r.value);
      }
    });
  } catch { /* ignore */ }

  // Stats
  const totalPositions = traderDataList.reduce((sum, t) => sum + t.positions.length, 0);
  const totalOrders = ingests.reduce((sum, i) => sum + Number(i.ordersCount ?? 0), 0);

  return (
    <main className="min-h-screen bg-[#0b0e11]">
      {/* Top nav bar */}
      <nav className="border-b border-[#2b3139] bg-[#1e2329]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f0b90b] flex items-center justify-center font-bold text-[#1e2329] text-sm">
              CT
            </div>
            <span className="text-white font-semibold text-lg">Copy Trading Tracker</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/signals"
              className="text-[#848e9c] hover:text-white text-sm transition-colors"
            >
              🔥 Signals
            </Link>
            <a
              href="http://localhost:3000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#848e9c] hover:text-white text-sm transition-colors"
            >
              API Docs
            </a>
            <div className="w-2 h-2 rounded-full bg-[#0ecb81]" title="Backend connected" />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatBox label="Traders" value={traderIds.length} icon="👥" />
          <StatBox label="Snapshots" value={ingests.length} icon="📸" />
          <StatBox label="Active Positions" value={totalPositions} icon="📊" />
          <StatBox label="Orders Tracked" value={totalOrders} icon="📋" />
        </div>

        {error && (
          <div className="bg-[#f6465d]/10 border border-[#f6465d]/30 rounded-xl p-4 mb-8">
            <p className="text-[#f6465d] text-sm font-medium">Connection Error</p>
            <p className="text-[#848e9c] text-xs mt-1">Backend is not running at http://localhost:3000</p>
          </div>
        )}

        {/* 2-column layout: Traders on left, Activity Feed on right */}
        <div className="flex gap-6">
          {/* Left column - Trader cards */}
          <div className="flex-1 min-w-0">
            {/* Section title */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-bold text-xl">Lead Traders</h2>
                <p className="text-[#848e9c] text-sm mt-1">Monitoring {traderIds.length} traders • Data refreshes every 60s</p>
              </div>
            </div>

            {/* Trader cards grid */}
            {traderDataList.length === 0 ? (
              <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-12 text-center">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-white font-medium mb-2">No traders found</p>
                <p className="text-[#848e9c] text-sm">The scraper will start collecting data automatically</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {traderDataList.map((trader) => (
                  <TraderListCard
                    key={trader.leadId}
                    leadId={trader.leadId}
                    portfolio={trader.portfolio}
                    performance={trader.performance}
                    positions={trader.positions}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right column - Charts & Activity Feed (hidden on mobile, sticky on desktop) */}
          <div className="hidden xl:block w-96 flex-shrink-0 space-y-6">
            {/* Event History Chart */}
            <EventHistoryChart timeRange="24h" />

            {/* Activity Feed */}
            <div className="sticky top-6">
              <ActivityFeed />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[#474d57] text-xs mt-12 pb-4">
          Copy Trading Intelligence Platform • Real-time Binance Data
        </div>
      </div>
    </main>
  );
}
