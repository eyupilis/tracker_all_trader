'use client';

import { useState, useCallback } from 'react';
import type { PositionHistoryRecord } from '@/lib/api';

interface BinancePositionHistoryProps {
  leadId: string;
  initialRecords: PositionHistoryRecord[];
  initialTotal: number;
}

function formatHistoryDate(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function formatDuration(openTs: number, closeTs: number): string {
  const ms = closeTs - openTs;
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

export function BinancePositionHistory({ leadId, initialRecords, initialTotal }: BinancePositionHistoryProps) {
  const [records, setRecords] = useState<PositionHistoryRecord[]>(initialRecords);
  const [total] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState('ALL');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'Long' | 'Short'>('ALL');
  const pageSize = 20;

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(
        'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/position-history',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portfolioId: leadId, pageNumber: nextPage, pageSize }),
        }
      );
      const json = await res.json();
      if (json.success && json.data?.list) {
        setRecords(prev => [...prev, ...json.data.list]);
        setPage(nextPage);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [leadId, page]);

  // Get unique symbols
  const symbols = Array.from(new Set(records.map(r => r.symbol))).sort();

  // Apply filters
  const filtered = records.filter(r => {
    if (symbolFilter !== 'ALL' && r.symbol !== symbolFilter) return false;
    if (sideFilter !== 'ALL' && r.side !== sideFilter) return false;
    return true;
  });

  const hasMore = records.length < total;

  // Summary stats
  const totalPnl = filtered.reduce((s, r) => s + r.closingPnl, 0);
  const winCount = filtered.filter(r => r.closingPnl > 0).length;
  const lossCount = filtered.filter(r => r.closingPnl < 0).length;

  return (
    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#2b3139]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-semibold text-sm">Position History</h3>
            <span className="text-[#848e9c] text-xs">{filtered.length} of {total}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-[#0ecb81]">Win: {winCount}</span>
            <span className="text-[#f6465d]">Loss: {lossCount}</span>
            <span className={`font-mono font-medium ${totalPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              PnL: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDT
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Side filter */}
          <div className="flex rounded-lg overflow-hidden border border-[#474d57]">
            {(['ALL', 'Long', 'Short'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSideFilter(s)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  sideFilter === s
                    ? s === 'Long' ? 'bg-[#0ecb81] text-white'
                      : s === 'Short' ? 'bg-[#f6465d] text-white'
                      : 'bg-[#f0b90b] text-[#1e2329]'
                    : 'bg-transparent text-[#848e9c] hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Symbol filter */}
          <select
            value={symbolFilter}
            onChange={e => setSymbolFilter(e.target.value)}
            className="bg-[#2b3139] text-white text-xs rounded-lg border border-[#474d57] px-3 py-1 outline-none focus:border-[#f0b90b]"
          >
            <option value="ALL">All Symbols</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
              <th className="text-left px-5 py-2.5 font-medium">Symbol</th>
              <th className="text-left px-3 py-2.5 font-medium">Side</th>
              <th className="text-right px-3 py-2.5 font-medium">Entry</th>
              <th className="text-right px-3 py-2.5 font-medium">Close</th>
              <th className="text-right px-3 py-2.5 font-medium">Size</th>
              <th className="text-right px-3 py-2.5 font-medium">PnL</th>
              <th className="text-left px-3 py-2.5 font-medium">Margin</th>
              <th className="text-left px-3 py-2.5 font-medium">Opened</th>
              <th className="text-left px-3 py-2.5 font-medium">Closed</th>
              <th className="text-right px-5 py-2.5 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-[#848e9c] text-sm">
                  No position history found
                </td>
              </tr>
            ) : (
              filtered.map((record, i) => {
                const isLong = record.side === 'Long';
                const symbol = record.symbol.replace('USDT', '');
                const pnlPositive = record.closingPnl >= 0;
                const totalValue = record.closedVolume * record.avgClosePrice;

                return (
                  <tr
                    key={`${record.id}-${i}`}
                    className="border-b border-[#2b3139] last:border-b-0 hover:bg-[#2b3139]/50 transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      <span className="text-white text-sm font-medium">{symbol}</span>
                      <span className="text-[#848e9c] text-xs">/USDT</span>
                      <div className="text-[#474d57] text-[10px]">{record.type}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isLong
                          ? 'bg-[#0ecb81]/10 text-[#0ecb81]'
                          : 'bg-[#f6465d]/10 text-[#f6465d]'
                      }`}>
                        {record.side}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-white text-sm font-mono">
                      {record.avgCost >= 1000
                        ? record.avgCost.toLocaleString('en', { maximumFractionDigits: 2 })
                        : record.avgCost >= 1 ? record.avgCost.toFixed(4) : record.avgCost.toFixed(6)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white text-sm font-mono">
                      {record.avgClosePrice >= 1000
                        ? record.avgClosePrice.toLocaleString('en', { maximumFractionDigits: 2 })
                        : record.avgClosePrice >= 1 ? record.avgClosePrice.toFixed(4) : record.avgClosePrice.toFixed(6)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="text-white text-sm font-mono">
                        {record.closedVolume.toLocaleString('en', { maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[#474d57] text-[10px]">
                        ≈ {totalValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className={`px-3 py-2.5 text-right text-sm font-mono font-medium ${
                      pnlPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}>
                      {pnlPositive ? '+' : ''}{record.closingPnl.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[#848e9c] text-xs">{record.isolated}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[#848e9c] text-xs font-mono">
                      {formatHistoryDate(record.opened)}
                    </td>
                    <td className="px-3 py-2.5 text-[#848e9c] text-xs font-mono">
                      {formatHistoryDate(record.closed)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="text-[#474d57] text-xs font-mono">
                        {formatDuration(record.opened, record.closed)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="px-5 py-4 flex justify-center border-t border-[#2b3139]">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-8 py-2.5 bg-[#2b3139] hover:bg-[#3a4150] text-white text-sm font-medium rounded-lg border border-[#474d57] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </span>
            ) : 'More'}
          </button>
        </div>
      )}
    </div>
  );
}
