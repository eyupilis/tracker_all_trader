'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { RoiDataPoint } from '@/lib/api';

type ChartRange = '7D' | '30D' | '90D';

interface BinanceRoiChartProps {
  roiSeries: RoiDataPoint[];
  leadId?: string;
}

async function fetchRoiSeries(leadId: string, timeRange: ChartRange): Promise<RoiDataPoint[]> {
  try {
    const res = await fetch(
      `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/chart-data?dataType=ROI&portfolioId=${leadId}&timeRange=${timeRange}`
    );
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data as RoiDataPoint[];
    }
    return [];
  } catch {
    return [];
  }
}

export function BinanceRoiChart({ roiSeries, leadId }: BinanceRoiChartProps) {
  const [selectedRange, setSelectedRange] = useState<ChartRange>('30D');
  const [liveSeries, setLiveSeries] = useState<Record<ChartRange, RoiDataPoint[] | null>>({
    '7D': null,
    '30D': null,
    '90D': null,
  });
  const [loading, setLoading] = useState(false);

  const loadRange = useCallback(async (range: ChartRange) => {
    if (!leadId) return;
    if (range === '30D' && roiSeries.length > 0 && liveSeries['30D'] === null) {
      setLiveSeries(prev => ({ ...prev, '30D': roiSeries }));
      return;
    }
    if (liveSeries[range] !== null) return; // already loaded

    setLoading(true);
    const data = await fetchRoiSeries(leadId, range);
    setLiveSeries(prev => ({ ...prev, [range]: data }));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, roiSeries]);

  useEffect(() => {
    loadRange(selectedRange);
  }, [selectedRange, loadRange]);

  const data = useMemo(() => {
    // Use default roiSeries for 30D, fetch others on demand
    const activeSeries = liveSeries[selectedRange] ?? (selectedRange === '30D' ? roiSeries : []);
    if (!activeSeries || activeSeries.length === 0) return [];
    return [...activeSeries]
      .sort((a, b) => a.dateTime - b.dateTime)
      .map((point) => ({
        date: new Date(point.dateTime).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        roi: parseFloat(String(point.value)) * 100,
        dataType: point.dataType,
        ts: point.dateTime,
      }));
  }, [liveSeries, selectedRange, roiSeries]);

  if (data.length === 0 && !loading) {
    return (
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-8 text-center">
        <div className="text-[#848e9c] text-sm">No ROI data</div>
      </div>
    );
  }

  const latestRoi = data[data.length - 1]?.roi || 0;
  const minRoi = data.length > 0 ? Math.min(...data.map((d) => d.roi)) : 0;
  const maxRoi = data.length > 0 ? Math.max(...data.map((d) => d.roi)) : 0;
  const isPositive = latestRoi >= 0;
  const dataType = data[0]?.dataType || 'ROI';

  // Period stats
  const startRoi = data[0]?.roi || 0;
  const change = latestRoi - startRoi;
  const maxDrawdownInPeriod = data.reduce((mdd, point, i) => {
    if (i === 0) return 0;
    const peak = Math.max(...data.slice(0, i + 1).map(d => d.roi));
    const dd = peak - point.roi;
    return Math.max(mdd, dd);
  }, 0);

  const RANGE_LABELS: Record<ChartRange, string> = { '7D': '7 Days', '30D': '30 Days', '90D': '90 Days' };

  return (
    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2b3139]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-sm">{dataType} ({RANGE_LABELS[selectedRange]})</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2b3139] text-[#848e9c] border border-[#474d57]">
              {data.length} pts
            </span>
          </div>
          <div className={`text-lg font-bold font-mono ${isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            {isPositive ? '+' : ''}{latestRoi.toFixed(2)}%
          </div>
        </div>
        <div className="flex items-center justify-between">
          {/* Range picker */}
          <div className="flex gap-1 bg-[#0b0e11] rounded-lg p-0.5">
            {(['7D', '30D', '90D'] as ChartRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  selectedRange === r
                    ? 'bg-[#f0b90b] text-[#0b0e11]'
                    : 'text-[#848e9c] hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {/* Mini stats */}
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-[#848e9c]">
              Δ <span className={change >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            </span>
            <span className="text-[#848e9c]">
              MDD <span className="text-[#f6465d]">{maxDrawdownInPeriod.toFixed(1)}%</span>
            </span>
          </div>
        </div>
      </div>
      <div className="p-4 relative">
        {loading && (
          <div className="absolute inset-0 bg-[#1e2329]/80 flex items-center justify-center z-10 rounded-b-xl">
            <div className="text-[#f0b90b] text-sm animate-pulse">Loading {selectedRange} data...</div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`roiGrad-${selectedRange}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#0ecb81' : '#f6465d'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isPositive ? '#0ecb81' : '#f6465d'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#848e9c', fontSize: 11 }}
              axisLine={{ stroke: '#2b3139' }}
              tickLine={false}
              interval={selectedRange === '90D' ? Math.floor(data.length / 8) : undefined}
            />
            <YAxis
              tick={{ fill: '#848e9c', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              domain={[
                Math.floor(minRoi - Math.abs(maxRoi - minRoi) * 0.1),
                Math.ceil(maxRoi + Math.abs(maxRoi - minRoi) * 0.1),
              ]}
            />
            <ReferenceLine y={0} stroke="#474d57" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#2b3139',
                border: '1px solid #474d57',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#848e9c' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, dataType]}
              itemStyle={{ color: isPositive ? '#0ecb81' : '#f6465d' }}
            />
            <Area
              type="monotone"
              dataKey="roi"
              stroke={isPositive ? '#0ecb81' : '#f6465d'}
              strokeWidth={2}
              fill={`url(#roiGrad-${selectedRange})`}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
