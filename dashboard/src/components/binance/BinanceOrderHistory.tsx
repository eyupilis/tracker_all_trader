'use client';

import type { Order } from '@/lib/api';
import { useState, useMemo } from 'react';

interface BinanceOrderHistoryProps {
  orders: Order[];
  total: number;
}

export function BinanceOrderHistory({ orders, total }: BinanceOrderHistoryProps) {
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'time' | 'pnl'>('time');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const symbols = useMemo(() => {
    const set = new Set(orders.map((o) => o.symbol));
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;
    if (sideFilter !== 'ALL') {
      result = result.filter((o) => o.side === sideFilter);
    }
    if (symbolFilter !== 'ALL') {
      result = result.filter((o) => o.symbol === symbolFilter);
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'time') {
        return sortDir === 'desc' ? b.orderUpdateTime - a.orderUpdateTime : a.orderUpdateTime - b.orderUpdateTime;
      }
      return sortDir === 'desc' ? (b.totalPnl || 0) - (a.totalPnl || 0) : (a.totalPnl || 0) - (b.totalPnl || 0);
    });
    return result;
  }, [orders, sideFilter, symbolFilter, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const totalPnl = useMemo(() => filtered.reduce((s, o) => s + (o.totalPnl || 0), 0), [filtered]);

  return (
    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] overflow-hidden">
      {/* Header & filters */}
      <div className="px-5 py-3 border-b border-[#2b3139]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-semibold text-sm">Order History</h3>
            <span className="text-[#848e9c] text-xs">{filtered.length} of {total} orders</span>
          </div>
          <div className={`text-sm font-mono font-medium ${totalPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            Total: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDT
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Side filter */}
          <div className="flex rounded-lg overflow-hidden border border-[#474d57]">
            {(['ALL', 'BUY', 'SELL'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setSideFilter(s); setPage(0); }}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  sideFilter === s
                    ? s === 'BUY' ? 'bg-[#0ecb81] text-white' : s === 'SELL' ? 'bg-[#f6465d] text-white' : 'bg-[#f0b90b] text-[#1e2329]'
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
            onChange={(e) => { setSymbolFilter(e.target.value); setPage(0); }}
            className="bg-[#2b3139] text-white text-xs rounded-lg border border-[#474d57] px-3 py-1 outline-none focus:border-[#f0b90b]"
          >
            <option value="ALL">All Symbols</option>
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {/* Sort */}
          <button
            onClick={() => {
              if (sortBy === 'time') { setSortBy('pnl'); } 
              else { setSortBy('time'); }
            }}
            className="bg-[#2b3139] text-[#848e9c] hover:text-white text-xs rounded-lg border border-[#474d57] px-3 py-1 transition-colors"
          >
            Sort: {sortBy === 'time' ? '⏱ Time' : '💰 PnL'}
          </button>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="bg-[#2b3139] text-[#848e9c] hover:text-white text-xs rounded-lg border border-[#474d57] px-3 py-1 transition-colors"
          >
            {sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
              <th className="text-left px-5 py-2.5 font-medium">Symbol</th>
              <th className="text-left px-3 py-2.5 font-medium">Side</th>
              <th className="text-left px-3 py-2.5 font-medium">Type</th>
              <th className="text-right px-3 py-2.5 font-medium">Filled / Qty</th>
              <th className="text-right px-3 py-2.5 font-medium">Avg Price</th>
              <th className="text-right px-3 py-2.5 font-medium">PnL</th>
              <th className="text-right px-3 py-2.5 font-medium">Placed</th>
              <th className="text-right px-5 py-2.5 font-medium">Filled</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-[#848e9c] text-sm">No orders match filters</td>
              </tr>
            ) : (
              paged.map((order, i) => {
                const isBuy = order.side === 'BUY';
                const symbol = order.symbol.replace('USDT', '');
                const posDir = order.positionSide === 'BOTH'
                  ? (isBuy ? 'LONG' : 'SHORT')
                  : order.positionSide;

                return (
                  <tr
                    key={`${order.symbol}-${order.orderUpdateTime}-${i}`}
                    className="border-b border-[#2b3139] last:border-b-0 hover:bg-[#2b3139]/50 transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      <span className="text-white text-sm">{symbol}</span>
                      <span className="text-[#848e9c] text-xs">/USDT</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold ${isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                          {order.side}
                        </span>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${
                          posDir === 'LONG' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'
                        }`}>
                          {posDir}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[#848e9c] text-xs">{order.type || 'MARKET'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-white text-sm font-mono">{order.executedQty}</span>
                      {order.origQty !== undefined && order.origQty > 0 && (
                        <>
                          <span className="text-[#474d57] text-xs"> / {order.origQty}</span>
                          <div className="w-full h-1 bg-[#2b3139] rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-[#f0b90b] rounded-full"
                              style={{ width: `${Math.min((order.executedQty / order.origQty) * 100, 100)}%` }}
                            />
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white text-sm font-mono">
                      {order.avgPrice >= 1000
                        ? order.avgPrice.toLocaleString('en', { maximumFractionDigits: 2 })
                        : order.avgPrice >= 1
                          ? order.avgPrice.toFixed(4)
                          : order.avgPrice.toFixed(6)}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-sm font-mono font-medium ${
                      (order.totalPnl || 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                    }`}>
                      {order.totalPnl !== undefined && order.totalPnl !== null
                        ? `${order.totalPnl >= 0 ? '+' : ''}${order.totalPnl.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#848e9c] text-xs font-mono">
                      {new Date(order.orderTime).toLocaleString('en', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="text-[#848e9c] text-xs font-mono">
                        {new Date(order.orderUpdateTime).toLocaleString('en', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {order.orderUpdateTime !== order.orderTime && (
                        <div className="text-[#474d57] text-[10px]">
                          {(() => {
                            const delta = order.orderUpdateTime - order.orderTime;
                            if (delta < 1000) return `${delta}ms`;
                            if (delta < 60000) return `${(delta / 1000).toFixed(1)}s`;
                            return `${(delta / 60000).toFixed(1)}m`;
                          })()}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2b3139]">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1.5 rounded bg-[#2b3139] text-[#848e9c] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-[#848e9c] text-xs">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs px-3 py-1.5 rounded bg-[#2b3139] text-[#848e9c] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
