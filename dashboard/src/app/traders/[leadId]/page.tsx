import { getTraderData, getTraderPerformanceMulti, getTraderLatestRecords, getTraderPositionHistory, MultiRangePerformance, RawIngest, TraderPayload, LatestRecord, PositionHistoryRecord } from '@/lib/api';
import { TraderProfileHeader } from '@/components/binance/TraderProfileHeader';
import { BinancePositionsTable } from '@/components/binance/BinancePositionsTable';
import { BinanceOrderHistory } from '@/components/binance/BinanceOrderHistory';
import { BinanceRoiChart } from '@/components/binance/BinanceRoiChart';
import { BinanceAssetChart } from '@/components/binance/BinanceAssetChart';
import { PerformanceStats } from '@/components/binance/PerformanceStats';
import { RawPayloadViewer } from '@/components/RawPayloadViewer';
import { BinanceTabs } from '@/components/binance/BinanceTabs';
import Link from 'next/link';

interface PageProps {
    params: Promise<{ leadId: string }>;
    searchParams: Promise<{ compare?: string | string[] }>;
}

export default async function TraderProfilePage({ params }: PageProps) {
    const { leadId } = await params;

    let traderData: TraderPayload | null = null;
    let latestRawIngest: RawIngest | null = null;
    let error: string | null = null;

    try {
        const response = await getTraderData(leadId, true, 2);
        const snapshots = response.data
            .filter((item) => item.payload)
            .sort((a, b) => {
                const tb = Number.isNaN(Date.parse(b.fetchedAt)) ? 0 : Date.parse(b.fetchedAt);
                const ta = Number.isNaN(Date.parse(a.fetchedAt)) ? 0 : Date.parse(a.fetchedAt);
                return tb - ta;
            });

        if (response.success && snapshots.length > 0) {
            latestRawIngest = snapshots[0];
            traderData = snapshots[0].payload as TraderPayload;
        } else {
            error = 'Trader not found';
        }
    } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to fetch trader data';
    }

    // Fetch real-time data from Binance (performance, latest records, position history)
    let allPerformance: MultiRangePerformance = { '7D': null, '30D': null, '90D': null };
    let latestRecords: { list: LatestRecord[]; total: number } = { list: [], total: 0 };
    let positionHistory: { list: PositionHistoryRecord[]; total: number } = { list: [], total: 0 };
    try {
        const [perf, lr, ph] = await Promise.all([
            getTraderPerformanceMulti(leadId),
            getTraderLatestRecords(leadId, 1, 100),
            getTraderPositionHistory(leadId, 1, 20),
        ]);
        allPerformance = perf;
        latestRecords = lr;
        positionHistory = ph;
        console.log('[DEBUG] latestRecords:', JSON.stringify({ total: lr.total, count: lr.list.length, first: lr.list[0]?.symbol }));
        console.log('[DEBUG] positionHistory:', JSON.stringify({ total: ph.total, count: ph.list.length }));
    } catch (e) { console.error('[DEBUG] Promise.all error:', e); }
    const performance = allPerformance['30D'];

    if (error || !traderData) {
        return (
            <main className="min-h-screen bg-[#0b0e11]">
                <nav className="border-b border-[#2b3139] bg-[#1e2329]">
                    <div className="max-w-7xl mx-auto px-6 py-3">
                        <Link href="/" className="text-[#f0b90b] hover:text-[#f0b90b]/80 text-sm">
                            ← Back to Traders
                        </Link>
                    </div>
                </nav>
                <div className="max-w-7xl mx-auto px-6 py-12">
                    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-12 text-center">
                        <div className="text-4xl mb-4">🔍</div>
                        <h1 className="text-xl text-white font-semibold mb-2">Trader Not Found</h1>
                        <p className="text-[#848e9c] text-sm">{error || 'No data available'}</p>
                        <p className="text-[#474d57] text-xs mt-4 font-mono">{leadId}</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#0b0e11]">
            {/* Nav */}
            <nav className="border-b border-[#2b3139] bg-[#1e2329]">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <Link href="/" className="text-[#f0b90b] hover:text-[#f0b90b]/80 text-sm">
                        ← Back to Traders
                    </Link>
                    <div className="text-[#474d57] text-xs font-mono">
                        {latestRawIngest && `Updated: ${new Date(latestRawIngest.fetchedAt).toLocaleString()}`}
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Profile header */}
                <TraderProfileHeader
                    portfolio={traderData.portfolioDetail}
                    leadId={leadId}
                    leadCommon={traderData.leadCommon}
                    performance={performance}
                />

                {/* Tabbed content */}
                <BinanceTabs
                    traderData={traderData}
                    performance={performance}
                    allPerformance={allPerformance}
                    latestRecords={latestRecords}
                    positionHistory={positionHistory}
                />

                {/* Footer */}
                <div className="text-center text-[#474d57] text-xs pb-4">
                    <p className="font-mono">{leadId}</p>
                </div>
            </div>
        </main>
    );
}
