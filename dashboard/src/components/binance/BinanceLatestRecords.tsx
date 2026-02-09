'use client';

import { useState, useCallback, useMemo } from 'react';
import type { LatestRecord } from '@/lib/api';

interface BinanceLatestRecordsProps {
  leadId: string;
  initialRecords: LatestRecord[];
  initialTotal: number;
}

// ── Accurate Open/Close detection ──
// Hedge mode (positionSide = LONG or SHORT):
//   BUY  + LONG  → Open Long     SELL + LONG  → Close Long
//   SELL + SHORT → Open Short    BUY  + SHORT → Close Short
// One-way mode (positionSide = BOTH):
//   totalPnl === 0 → Opening trade    totalPnl !== 0 → Closing trade
//   BUY → Long direction              SELL → Short direction

type TradeAction = 'Open Long' | 'Close Long' | 'Open Short' | 'Close Short';

function getTradeAction(record: LatestRecord): TradeAction {
  const { side, positionSide, totalPnl } = record;

  if (positionSide === 'LONG') {
    return side === 'BUY' ? 'Open Long' : 'Close Long';
  }
  if (positionSide === 'SHORT') {
    return side === 'SELL' ? 'Open Short' : 'Close Short';
  }

  // positionSide === 'BOTH' (one-way mode)
  const isClosing = totalPnl !== 0 && totalPnl !== undefined && totalPnl !== null;
  if (isClosing) {
    return side === 'SELL' ? 'Close Long' : 'Close Short';
  }
  return side === 'BUY' ? 'Open Long' : 'Open Short';
}

function getActionStyle(action: TradeAction): { color: string; bgColor: string } {
  switch (action) {
    case 'Open Long':
      return { color: '#0ecb81', bgColor: 'rgba(14,203,129,0.15)' };
    case 'Close Long':
      return { color: '#f6465d', bgColor: 'rgba(246,70,93,0.15)' };
    case 'Open Short':
      return { color: '#f6465d', bgColor: 'rgba(246,70,93,0.15)' };
    case 'Close Short':
      return { color: '#0ecb81', bgColor: 'rgba(14,203,129,0.15)' };
  }
}

function isOpenAction(action: TradeAction): boolean {
  return action === 'Open Long' || action === 'Open Short';
}

// ── Formatting helpers ──
function formatPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString('en', { maximumFractionDigits: 2 });
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.01) return price.toFixed(5);
  return price.toFixed(6);
}

function formatRecordDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}-${dd}, ${hh}:${min}:${ss}`;
}

type FilterMode = 'ALL' | 'OPENS' | 'CLOSES';

export function BinanceLatestRecords({ leadId, initialRecords, initialTotal }: BinanceLatestRecordsProps) {
  const [records, setRecords] = useState<LatestRecord[]>(initialRecords);
  const [total] = useState(initialTotal);
  const [page, setPage] = useState(Math.ceil(initialRecords.length / 20));
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const pageSize = 20;

  const filteredRecords = useMemo(() => {
    if (filterMode === 'ALL') return records;
    return records.filter((r) => {
      const action = getTradeAction(r);
      if (filterMode === 'OPENS') return isOpenAction(action);
      return !isOpenAction(action);
    });
  }, [records, filterMode]);

  const openCount = useMemo(
    () => records.filter((r) => isOpenAction(getTradeAction(r))).length,
    [records]
  );
  const closeCount = records.length - openCount;

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(
        'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portfolioId: leadId, pageNumber: nextPage, pageSize }),
        }
      );
      const json = await res.json();
      if (json.success && json.data?.list) {
        setRecords((prev) => [...prev, ...json.data.list]);
        setPage(nextPage);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [leadId, page]);

  const hasMore = records.length < total;

  if (records.length === 0) {
    return (
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-12 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-white font-semibold text-sm mb-2">No Latest Records</h3>
        <p className="text-[#848e9c] text-xs">No trade records available for this trader. (initialRecords: {initialRecords.length}, total: {initialTotal})</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Latest Records Timeline ── */}
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] overflow-hidden">
        {/* Header & Filters */}
        <div className="px-5 py-3 border-b border-[#2b3139]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-semibold text-sm">Latest Records</h3>
              <span className="text-[#848e9c] text-xs">
                {filteredRecords.length} of {total}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#0ecb81]">Opens: {openCount}</span>
              <span className="text-[#f6465d]">Closes: {closeCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-[#474d57]">
              {([
                { key: 'ALL' as FilterMode, label: 'All', activeClass: 'bg-[#f0b90b] text-[#1e2329]' },
                { key: 'OPENS' as FilterMode, label: 'Opens', activeClass: 'bg-[#0ecb81] text-white' },
                { key: 'CLOSES' as FilterMode, label: 'Closes', activeClass: 'bg-[#f6465d] text-white' },
              ]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterMode(f.key)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    filterMode === f.key
                      ? f.activeClass
                      : 'bg-transparent text-[#848e9c] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {filterMode === 'OPENS' && (
              <span className="text-[#f0b90b] text-[10px] bg-[#f0b90b]/10 px-2 py-0.5 rounded">
                💡 Showing only position openings — track what the trader is buying/selling
              </span>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="px-5 py-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-[#848e9c] text-sm">
              No {filterMode === 'OPENS' ? 'opening' : filterMode === 'CLOSES' ? 'closing' : ''} trade records found
            </div>
          ) : (
            <div className="space-y-0">
              {filteredRecords.map((record, idx) => {
                const action = getTradeAction(record);
                const style = getActionStyle(action);
                const totalValue = record.executedQty * record.avgPrice;
                const symbol = record.symbol.replace('USDT', '');
                const hasPnl = record.totalPnl !== 0 && record.totalPnl !== undefined && record.totalPnl !== null;
                const isOpen = isOpenAction(action);

                return (
                  <div
                    key={`${record.symbol}-${record.orderTime}-${idx}`}
                    className={`flex gap-4 py-4 border-b border-[#2b3139]/50 last:border-b-0 group ${
                      isOpen ? 'bg-[#f0b90b]/[0.02]' : ''
                    }`}
                  >
                    {/* Timestamp */}
                    <div className="flex-shrink-0 w-[120px] pt-0.5">
                      <span className="text-[#848e9c] text-xs font-mono">
                        {formatRecordDate(record.orderTime)}
                      </span>
                    </div>

                    {/* Timeline dot */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5"
                        style={{ backgroundColor: style.color }}
                      />
                      <div className="w-px flex-1 bg-[#2b3139] mt-1" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <span
                        className="inline-block px-2.5 py-1 rounded text-xs font-semibold mb-2"
                        style={{ color: style.color, backgroundColor: style.bgColor }}
                      >
                        {action}
                      </span>

                      <p className="text-[#eaecef] text-sm leading-relaxed">
                        {isOpen ? 'Open' : 'Close'}
                        {' a '}
                        {action.includes('Long') ? 'Long' : 'Short'}
                        {' position of '}
                        <span className="text-white font-medium underline decoration-dotted underline-offset-2 cursor-default">
                          {symbol}USDT Perpetual
                        </span>
                        {' at a price of '}
                        <span className="text-white font-semibold">
                          {formatPrice(record.avgPrice)}
                        </span>
                        {' USDT, amount of '}
                        <span className="text-white font-medium">
                          {record.executedQty.toLocaleString('en', { maximumFractionDigits: 3 })}
                        </span>
                        {` ${symbol} for a total value of `}
                        <span className="text-white font-semibold">
                          {totalValue.toLocaleString('en', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        {' USDT'}
                        {hasPnl && (
                          <>
                            {'. Realized PNL is '}
                            <span
                              className="font-semibold"
                              style={{ color: record.totalPnl >= 0 ? '#0ecb81' : '#f6465d' }}
                            >
                              {record.totalPnl.toLocaleString('en', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            {' USDT'}
                          </>
                        )}
                        {'.'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="px-5 pb-5 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-8 py-2.5 bg-[#2b3139] hover:bg-[#3a4150] text-white text-sm font-medium rounded-lg border border-[#474d57] transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading...
                </span>
              ) : (
                'More'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
