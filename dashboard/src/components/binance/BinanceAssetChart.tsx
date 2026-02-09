'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CoinPnlItem {
  symbol: string;
  pnl: string | number;
  roi: string | number;
}

interface AssetData {
  data?: CoinPnlItem[] | { coinPnlList?: CoinPnlItem[]; coinPositionList?: unknown[] };
  timeRange?: string;
  updateTime?: number;
  [key: string]: unknown;
}

interface BinanceAssetChartProps {
  assetPreferences: AssetData | null;
}

const COLORS = ['#f0b90b', '#0ecb81', '#f6465d', '#1e96fc', '#b659ff', '#ff6b35', '#00d9ff', '#ff4081', '#76ff03', '#ffd600'];

export function BinanceAssetChart({ assetPreferences }: BinanceAssetChartProps) {
  const data = useMemo(() => {
    if (!assetPreferences) return [];

    // Handle different response shapes
    let coins: CoinPnlItem[] = [];
    if (Array.isArray(assetPreferences.data)) {
      // Old format: data is directly array with asset/volume
      return (assetPreferences.data as unknown as { asset: string; volume: number }[]).map((item) => ({
        name: item.asset,
        value: Math.abs(item.volume),
        pnl: item.volume,
      }));
    }
    
    const nested = assetPreferences.data as { coinPnlList?: CoinPnlItem[] } | undefined;
    if (nested?.coinPnlList) {
      coins = nested.coinPnlList;
    } else if ((assetPreferences as Record<string, unknown>).coinPnlList) {
      coins = (assetPreferences as Record<string, unknown>).coinPnlList as CoinPnlItem[];
    }

    if (coins.length === 0) return [];

    return coins
      .map((c) => ({
        name: c.symbol.replace('USDT', ''),
        value: Math.abs(parseFloat(String(c.pnl))),
        pnl: parseFloat(String(c.pnl)),
        roi: parseFloat(String(c.roi)) * 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [assetPreferences]);

  if (data.length === 0) {
    return (
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-8 text-center">
        <div className="text-[#848e9c] text-sm">No asset data</div>
      </div>
    );
  }

  const totalPnl = data.reduce((s, d) => s + (d.pnl || 0), 0);

  return (
    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2b3139]">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Asset Distribution</h3>
          <div className={`text-sm font-mono font-medium ${totalPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            PnL: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </div>
        </div>
        {(assetPreferences?.timeRange || assetPreferences?.updateTime) && (
          <div className="flex items-center gap-3 mt-1.5">
            {assetPreferences.timeRange && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f0b90b]/10 text-[#f0b90b] border border-[#f0b90b]/20">
                {assetPreferences.timeRange}
              </span>
            )}
            {assetPreferences.updateTime && (
              <span className="text-[#474d57] text-[10px]">
                Updated: {new Date(assetPreferences.updateTime).toLocaleString('en', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            )}
            <span className="text-[#474d57] text-[10px]">
              {data.length} assets
            </span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col lg:flex-row items-center gap-4">
        <div className="w-full lg:w-1/2" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#2b3139',
                  border: '1px solid #474d57',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string, props: { payload?: { pnl?: number; roi?: number } }) => {
                  const pnl = props?.payload?.pnl;
                  const roi = props?.payload?.roi;
                  return [
                    <span key="v">
                      PnL: <span className={pnl !== undefined && pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                        {pnl !== undefined ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}` : value.toFixed(2)}
                      </span>
                      {roi !== undefined && <span className="text-[#848e9c] ml-2">({roi.toFixed(1)}%)</span>}
                    </span>,
                    name,
                  ];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value: string) => <span className="text-[#b7bdc6]">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Asset list */}
        <div className="w-full lg:w-1/2 space-y-1.5">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#2b3139] transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-white text-sm font-medium">{item.name}</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-mono ${item.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {item.pnl >= 0 ? '+' : ''}{item.pnl.toFixed(2)}
                </span>
                {'roi' in item && typeof item.roi === 'number' && (
                  <span className="text-[#848e9c] text-xs ml-2">({item.roi.toFixed(1)}%)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
