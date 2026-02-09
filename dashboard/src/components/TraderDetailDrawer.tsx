'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatNumber } from '@/lib/api';

interface TraderDetailDrawerProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TraderDetail {
  leadId: string;
  nickname: string;
  positionShow: boolean;
  segment: 'VISIBLE' | 'HIDDEN';

  // Trader Score
  qualityScore: number | null;
  confidence: 'low' | 'medium' | 'high' | null;
  traderWeight: number | null;
  winRate: number | null;
  sampleSize: number | null;

  // Performance
  roi30d: number | null;
  pnl30d: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  avgLeverage: number | null;
  totalTrades: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  profitFactor: number | null;

  // Activity
  openPositionsCount: number;
  recentEvents: Array<{
    eventType: string;
    symbol: string;
    eventTime: number;
    realizedPnl: number | null;
  }>;
}

export function TraderDetailDrawer({ leadId, isOpen, onClose }: TraderDetailDrawerProps) {
  const [trader, setTrader] = useState<TraderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchTraderDetail(leadId);
    }
  }, [isOpen, leadId]);

  const fetchTraderDetail = async (id: string) => {
    setIsLoading(true);
    try {
      // Fetch trader data from multiple endpoints
      const [traderRes, eventsRes] = await Promise.all([
        fetch(`/api/traders/${id}`),
        fetch(`/api/signals/events/feed?limit=10&timeRange=7d&leadId=${id}`),
      ]);

      const traderData = await traderRes.json();
      const eventsData = await eventsRes.json();

      // Combine data
      setTrader({
        leadId: id,
        nickname: traderData.nickname || 'Unknown Trader',
        positionShow: traderData.positionShow ?? false,
        segment: traderData.segment || 'UNKNOWN',
        qualityScore: traderData.qualityScore ?? null,
        confidence: traderData.confidence ?? null,
        traderWeight: traderData.traderWeight ?? null,
        winRate: traderData.winRate ?? null,
        sampleSize: traderData.sampleSize ?? null,
        roi30d: traderData.performance?.roi30d ?? null,
        pnl30d: traderData.performance?.pnl30d ?? null,
        sharpeRatio: traderData.performance?.sharpeRatio ?? null,
        maxDrawdown: traderData.performance?.maxDrawdown ?? null,
        avgLeverage: traderData.performance?.avgLeverage ?? null,
        totalTrades: traderData.performance?.totalTrades ?? null,
        avgWin: traderData.performance?.avgWin ?? null,
        avgLoss: traderData.performance?.avgLoss ?? null,
        profitFactor: traderData.performance?.profitFactor ?? null,
        openPositionsCount: traderData.positions?.length ?? 0,
        recentEvents: eventsData.success ? eventsData.data.slice(0, 10) : [],
      });
    } catch (error) {
      console.error('Failed to fetch trader detail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#0b0e11] z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#1e2329] border-b border-[#2b3139] p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg bg-slate-700">
                {trader?.nickname?.slice(0, 2).toUpperCase() || '??'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-white">{trader?.nickname || 'Loading...'}</h2>
              <p className="text-sm text-slate-400">Trader ID: {leadId?.slice(-8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : trader ? (
            <>
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={`${
                  trader.segment === 'VISIBLE' ? 'border-green-600/40 text-green-400' : 'border-orange-600/40 text-orange-400'
                }`}>
                  {trader.segment}
                </Badge>
                {trader.confidence && (
                  <Badge variant="outline" className={`${
                    trader.confidence === 'high' ? 'border-green-600/40 text-green-400' :
                    trader.confidence === 'medium' ? 'border-yellow-600/40 text-yellow-400' :
                    'border-red-600/40 text-red-400'
                  }`}>
                    Confidence: {trader.confidence}
                  </Badge>
                )}
                <Badge variant="outline" className="border-blue-600/40 text-blue-400">
                  {trader.openPositionsCount} Open Positions
                </Badge>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <MetricCard
                  label="Quality Score"
                  value={trader.qualityScore !== null ? `${trader.qualityScore}` : 'N/A'}
                  color={trader.qualityScore && trader.qualityScore >= 80 ? 'text-green-400' :
                         trader.qualityScore && trader.qualityScore >= 60 ? 'text-yellow-400' : 'text-red-400'}
                />
                <MetricCard
                  label="Trader Weight"
                  value={trader.traderWeight !== null ? trader.traderWeight.toFixed(3) : 'N/A'}
                  color="text-blue-400"
                />
                <MetricCard
                  label="Win Rate"
                  value={trader.winRate !== null ? `${(trader.winRate * 100).toFixed(1)}%` : 'N/A'}
                  color={trader.winRate && trader.winRate >= 0.6 ? 'text-green-400' : 'text-slate-400'}
                />
                <MetricCard
                  label="Sample Size"
                  value={trader.sampleSize !== null ? trader.sampleSize.toString() : 'N/A'}
                  color="text-slate-400"
                />
              </div>

              {/* Performance Section */}
              <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-6">
                <h3 className="text-lg font-semibold text-white mb-4">30-Day Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricItem
                    label="ROI"
                    value={trader.roi30d !== null ? `${trader.roi30d > 0 ? '+' : ''}${trader.roi30d.toFixed(2)}%` : 'N/A'}
                    valueColor={trader.roi30d !== null && trader.roi30d > 0 ? 'text-green-400' : 'text-red-400'}
                  />
                  <MetricItem
                    label="PnL"
                    value={trader.pnl30d !== null ? `$${formatNumber(trader.pnl30d)}` : 'N/A'}
                    valueColor={trader.pnl30d !== null && trader.pnl30d > 0 ? 'text-green-400' : 'text-red-400'}
                  />
                  <MetricItem
                    label="Sharpe Ratio"
                    value={trader.sharpeRatio !== null ? trader.sharpeRatio.toFixed(2) : 'N/A'}
                  />
                  <MetricItem
                    label="Max Drawdown"
                    value={trader.maxDrawdown !== null ? `${trader.maxDrawdown.toFixed(2)}%` : 'N/A'}
                    valueColor="text-red-400"
                  />
                  <MetricItem
                    label="Avg Leverage"
                    value={trader.avgLeverage !== null ? `${trader.avgLeverage.toFixed(1)}x` : 'N/A'}
                    valueColor="text-orange-400"
                  />
                  <MetricItem
                    label="Total Trades"
                    value={trader.totalTrades !== null ? trader.totalTrades.toString() : 'N/A'}
                  />
                </div>
              </div>

              {/* Trading Stats */}
              <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Trading Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricItem
                    label="Avg Win"
                    value={trader.avgWin !== null ? `$${formatNumber(trader.avgWin)}` : 'N/A'}
                    valueColor="text-green-400"
                  />
                  <MetricItem
                    label="Avg Loss"
                    value={trader.avgLoss !== null ? `$${formatNumber(trader.avgLoss)}` : 'N/A'}
                    valueColor="text-red-400"
                  />
                  <MetricItem
                    label="Profit Factor"
                    value={trader.profitFactor !== null ? trader.profitFactor.toFixed(2) : 'N/A'}
                    valueColor={trader.profitFactor && trader.profitFactor > 1 ? 'text-green-400' : 'text-red-400'}
                  />
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Activity (Last 7 Days)</h3>
                {trader.recentEvents.length > 0 ? (
                  <div className="space-y-3">
                    {trader.recentEvents.map((event, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            event.eventType.includes('OPEN') ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {event.eventType}
                          </span>
                          <span className="text-sm text-white font-mono">{event.symbol}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            {new Date(event.eventTime).toLocaleDateString()}
                          </div>
                          {event.realizedPnl !== null && (
                            <div className={`text-sm font-semibold ${
                              event.realizedPnl > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {event.realizedPnl > 0 ? '+' : ''}${formatNumber(event.realizedPnl)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-4">No recent activity</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">Failed to load trader details</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function MetricItem({ label, value, valueColor = 'text-slate-300' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-sm font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}
