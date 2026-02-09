'use client';

import { useState } from 'react';
import type { MultiRangePerformance, PerformanceData, TimeRange } from '@/lib/api';

interface MultiRangePerformanceCardProps {
  allPerformance: MultiRangePerformance;
}

const RANGE_LABELS: Record<TimeRange, string> = { '7D': '7 Days', '30D': '30 Days', '90D': '90 Days' };
const RANGES: TimeRange[] = ['7D', '30D', '90D'];

export function MultiRangePerformanceCard({ allPerformance }: MultiRangePerformanceCardProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30D');

  const selected = allPerformance[selectedRange];

  // Metric definitions
  const metrics: {
    key: string;
    label: string;
    getValue: (d: PerformanceData) => number;
    format: (v: number) => string;
    isBetter: 'higher' | 'lower';
    suffix?: string;
    prefix?: (v: number) => string;
  }[] = [
    {
      key: 'roi', label: 'ROI', getValue: d => d.roi, isBetter: 'higher',
      format: v => `${Math.abs(v).toFixed(2)}%`, prefix: v => v >= 0 ? '+' : '-',
    },
    {
      key: 'pnl', label: 'PnL', getValue: d => d.pnl, isBetter: 'higher',
      format: v => `$${Math.abs(v).toLocaleString('en', { maximumFractionDigits: 0 })}`, prefix: v => v >= 0 ? '+' : '-',
    },
    {
      key: 'mdd', label: 'Max Drawdown', getValue: d => d.mdd, isBetter: 'lower',
      format: v => `${v.toFixed(2)}%`,
    },
    {
      key: 'winRate', label: 'Win Rate', getValue: d => d.winRate, isBetter: 'higher',
      format: v => `${v.toFixed(1)}%`,
    },
    {
      key: 'sharpRatio', label: 'Sharpe Ratio', getValue: d => parseFloat(String(d.sharpRatio)) || 0, isBetter: 'higher',
      format: v => v.toFixed(2),
    },
    {
      key: 'copierPnl', label: 'Copier PnL', getValue: d => d.copierPnl, isBetter: 'higher',
      format: v => `$${Math.abs(v).toLocaleString('en', { maximumFractionDigits: 0 })}`, prefix: v => v >= 0 ? '+' : '-',
    },
    {
      key: 'totalOrder', label: 'Total Orders', getValue: d => d.totalOrder, isBetter: 'higher',
      format: v => v.toLocaleString(),
    },
    {
      key: 'winOrders', label: 'Win Orders', getValue: d => d.winOrders, isBetter: 'higher',
      format: v => v.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Comparison table ── */}
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2b3139] flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">📊 Performance Comparison</h3>
          <div className="text-[#474d57] text-xs">All timeframes</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2b3139]">
                <th className="text-left px-5 py-3 text-[#848e9c] text-xs font-medium">Metric</th>
                {RANGES.map(r => (
                  <th
                    key={r}
                    className={`text-right px-4 py-3 text-xs font-medium cursor-pointer transition-colors ${
                      selectedRange === r ? 'text-[#f0b90b]' : 'text-[#848e9c] hover:text-white'
                    }`}
                    onClick={() => setSelectedRange(r)}
                  >
                    {r}
                    {selectedRange === r && <span className="ml-1">●</span>}
                  </th>
                ))}
                <th className="text-right px-5 py-3 text-[#848e9c] text-xs font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => {
                const vals = RANGES.map(r => {
                  const d = allPerformance[r];
                  return d ? m.getValue(d) : null;
                });

                // Determine best range for this metric
                const validVals = vals.filter((v): v is number => v !== null);
                let bestIdx = -1;
                if (validVals.length > 0) {
                  if (m.isBetter === 'higher') {
                    bestIdx = vals.indexOf(Math.max(...validVals));
                  } else {
                    bestIdx = vals.indexOf(Math.min(...validVals));
                  }
                }

                // Trend: compare 7D vs 30D for momentum
                const v7 = vals[0];
                const v30 = vals[1];
                let trend: 'up' | 'down' | 'flat' = 'flat';
                if (v7 !== null && v30 !== null && v30 !== 0) {
                  // For ROI/PnL/WinRate - higher 7D vs 30D means improving
                  // For MDD - lower 7D vs 30D means improving
                  if (m.isBetter === 'higher') {
                    trend = v7 > v30 ? 'up' : v7 < v30 ? 'down' : 'flat';
                  } else {
                    trend = v7 < v30 ? 'up' : v7 > v30 ? 'down' : 'flat';
                  }
                }

                return (
                  <tr key={m.key} className="border-b border-[#2b3139]/60 last:border-b-0 hover:bg-[#2b3139]/30 transition-colors">
                    <td className="px-5 py-3 text-[#b7bdc6] text-sm">{m.label}</td>
                    {RANGES.map((r, i) => {
                      const v = vals[i];
                      const isBest = i === bestIdx;
                      const isSelected = r === selectedRange;

                      return (
                        <td key={r} className={`text-right px-4 py-3 font-mono text-sm ${isSelected ? 'bg-[#f0b90b]/5' : ''}`}>
                          {v !== null ? (
                            <span className={`${
                              isBest ? 'text-[#0ecb81] font-semibold' : 'text-white'
                            }`}>
                              {m.prefix?.(v)}{m.format(v)}
                              {isBest && <span className="text-[#0ecb81] text-[10px] ml-1">★</span>}
                            </span>
                          ) : (
                            <span className="text-[#474d57]">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right px-5 py-3">
                      <span className={`text-sm ${
                        trend === 'up' ? 'text-[#0ecb81]' : trend === 'down' ? 'text-[#f6465d]' : 'text-[#474d57]'
                      }`}>
                        {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Visual bars for selected timeframe ── */}
      {selected && (
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">
              {RANGE_LABELS[selectedRange]} Detail
            </h3>
            {/* Range toggle pills */}
            <div className="flex gap-1 bg-[#0b0e11] rounded-lg p-1">
              {RANGES.map(r => (
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
          </div>

          {/* ROI vs MDD visual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ROI gauge */}
            <div className="bg-[#0b0e11] rounded-lg p-4">
              <div className="text-[#848e9c] text-xs mb-2">ROI</div>
              <div className={`text-2xl font-bold font-mono mb-3 ${selected.roi >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {selected.roi >= 0 ? '+' : ''}{selected.roi.toFixed(2)}%
              </div>
              <div className="w-full h-2 bg-[#2b3139] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${selected.roi >= 0 ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`}
                  style={{ width: `${Math.min(Math.abs(selected.roi) / 10, 100)}%` }}
                />
              </div>
              {/* Compare with other ranges */}
              <div className="mt-3 space-y-1">
                {RANGES.filter(r => r !== selectedRange).map(r => {
                  const other = allPerformance[r];
                  if (!other) return null;
                  const diff = selected.roi - other.roi;
                  return (
                    <div key={r} className="flex items-center justify-between text-xs">
                      <span className="text-[#474d57]">vs {r}</span>
                      <span className={diff >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Win Rate & Orders */}
            <div className="bg-[#0b0e11] rounded-lg p-4">
              <div className="text-[#848e9c] text-xs mb-2">Win Rate</div>
              <div className="text-2xl font-bold font-mono text-white mb-3">
                {selected.winRate.toFixed(1)}%
              </div>
              {/* Win/Loss visual bar */}
              <div className="flex h-6 rounded-lg overflow-hidden mb-2">
                <div
                  className="bg-[#0ecb81] flex items-center justify-center text-[10px] text-white font-semibold transition-all"
                  style={{ width: `${selected.winRate}%` }}
                >
                  {selected.winOrders}W
                </div>
                <div
                  className="bg-[#f6465d] flex items-center justify-center text-[10px] text-white font-semibold transition-all"
                  style={{ width: `${100 - selected.winRate}%` }}
                >
                  {selected.totalOrder - selected.winOrders}L
                </div>
              </div>
              <div className="text-[#848e9c] text-xs">
                {selected.totalOrder} total orders
              </div>
              {/* Compare */}
              <div className="mt-3 space-y-1">
                {RANGES.filter(r => r !== selectedRange).map(r => {
                  const other = allPerformance[r];
                  if (!other) return null;
                  const diff = selected.winRate - other.winRate;
                  return (
                    <div key={r} className="flex items-center justify-between text-xs">
                      <span className="text-[#474d57]">vs {r}</span>
                      <span className={diff >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PnL + MDD + Sharpe row */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-[#0b0e11] rounded-lg p-3 text-center">
              <div className="text-[#474d57] text-[10px] uppercase tracking-wider mb-1">PnL</div>
              <div className={`text-lg font-bold font-mono ${selected.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {selected.pnl >= 0 ? '+' : '-'}${Math.abs(selected.pnl).toLocaleString('en', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="bg-[#0b0e11] rounded-lg p-3 text-center">
              <div className="text-[#474d57] text-[10px] uppercase tracking-wider mb-1">Max Drawdown</div>
              <div className="text-lg font-bold font-mono text-[#f6465d]">
                {selected.mdd.toFixed(2)}%
              </div>
            </div>
            <div className="bg-[#0b0e11] rounded-lg p-3 text-center">
              <div className="text-[#474d57] text-[10px] uppercase tracking-wider mb-1">Sharpe</div>
              <div className={`text-lg font-bold font-mono ${
                parseFloat(String(selected.sharpRatio)) >= 2 ? 'text-[#0ecb81]'
                : parseFloat(String(selected.sharpRatio)) >= 1 ? 'text-[#f0b90b]'
                : 'text-[#f6465d]'
              }`}>
                {(parseFloat(String(selected.sharpRatio)) || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
