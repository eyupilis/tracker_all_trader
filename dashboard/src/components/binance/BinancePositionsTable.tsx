'use client';

import { useState } from 'react';
import type { Position } from '@/lib/api';

interface BinancePositionsTableProps {
  positions: Position[];
}

type SortKey = 'symbol' | 'pnl' | 'notional' | 'leverage' | 'size';
type SortDir = 'asc' | 'desc';

export function BinancePositionsTable({ positions }: BinancePositionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('pnl');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (!positions || positions.length === 0) {
    return (
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-8 text-center">
        <div className="text-[#848e9c] text-sm">No active positions</div>
      </div>
    );
  }

  /* ── parse helpers ── */
  const num = (v: string | number | undefined) => parseFloat(String(v ?? '0')) || 0;

  /* ── derived data ── */
  const parsed = positions.map((pos) => {
    const amt = num(pos.positionAmount);
    const entry = num(pos.entryPrice);
    const mark = num(pos.markPrice);
    const pnl = num(pos.unrealizedProfit);
    const notional = num(pos.notionalValue);
    const cumRealized = num(pos.cumRealized);
    const breakEven = num(pos.breakEvenPrice);
    const askNotional = num(pos.askNotional);
    const bidNotional = num(pos.bidNotional);
    const isolatedWallet = num(pos.isolatedWallet);
    const leverage = pos.leverage;

    const side = pos.positionSide === 'BOTH'
      ? (amt > 0 ? 'LONG' : amt < 0 ? 'SHORT' : 'FLAT')
      : pos.positionSide;
    const isLong = side === 'LONG';
    const absAmt = Math.abs(amt);

    const pnlPercent = entry > 0 && absAmt > 0
      ? ((mark - entry) / entry * (isLong ? 1 : -1) * leverage * 100)
      : 0;

    const collateral = pos.collateral || 'USDT';
    const base = pos.symbol.replace(collateral, '');

    return {
      ...pos,
      amt, entry, mark, pnl, notional, cumRealized, breakEven,
      askNotional, bidNotional, isolatedWallet, leverage,
      side, isLong, absAmt, pnlPercent, base, collateral,
    };
  });

  /* ── sorting ── */
  const sorted = [...parsed].sort((a, b) => {
    const m = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'symbol': return m * a.symbol.localeCompare(b.symbol);
      case 'pnl': return m * (a.pnl - b.pnl);
      case 'notional': return m * (Math.abs(a.notional) - Math.abs(b.notional));
      case 'leverage': return m * (a.leverage - b.leverage);
      case 'size': return m * (a.absAmt - b.absAmt);
      default: return 0;
    }
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  /* ── summary stats ── */
  const totalPnl = parsed.reduce((s, p) => s + p.pnl, 0);
  const totalNotional = parsed.reduce((s, p) => s + Math.abs(p.notional), 0);
  const totalCumRealized = parsed.reduce((s, p) => s + p.cumRealized, 0);
  const longCount = parsed.filter(p => p.isLong).length;
  const shortCount = parsed.filter(p => !p.isLong).length;
  const maxLeverage = Math.max(...parsed.map(p => p.leverage));
  const avgLeverage = parsed.length > 0 ? parsed.reduce((s, p) => s + p.leverage, 0) / parsed.length : 0;
  const collaterals = [...new Set(parsed.map(p => p.collateral))];
  const isolatedCount = parsed.filter(p => p.isolated).length;

  const sortIcon = (key: SortKey) => {
    const active = sortKey === key;
    return (
      <span className={`ml-1 text-[10px] ${active ? 'text-[#f0b90b]' : 'text-[#474d57]'}`}>
        {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Summary stats bar ── */}
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <SummaryBox label="Positions" value={String(positions.length)} />
          <SummaryBox
            label="Total PnL"
            value={`${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString('en', { maximumFractionDigits: 2 })}`}
            color={totalPnl >= 0 ? 'green' : 'red'}
          />
          <SummaryBox
            label="Cum. Realized"
            value={`${totalCumRealized >= 0 ? '+' : ''}$${Math.abs(totalCumRealized).toLocaleString('en', { maximumFractionDigits: 2 })}`}
            color={totalCumRealized >= 0 ? 'green' : 'red'}
          />
          <SummaryBox
            label="Total Notional"
            value={`$${totalNotional.toLocaleString('en', { maximumFractionDigits: 0 })}`}
          />
          <SummaryBox
            label="Long / Short"
            value={`${longCount} / ${shortCount}`}
            extra={
              <div className="flex gap-0.5 mt-1">
                <div className="h-1 rounded-full bg-[#0ecb81]" style={{ width: `${parsed.length > 0 ? (longCount / parsed.length) * 100 : 50}%` }} />
                <div className="h-1 rounded-full bg-[#f6465d]" style={{ width: `${parsed.length > 0 ? (shortCount / parsed.length) * 100 : 50}%` }} />
              </div>
            }
          />
          <SummaryBox label="Max Leverage" value={`${maxLeverage}x`} color="gold" />
          <SummaryBox label="Avg Leverage" value={`${avgLeverage.toFixed(0)}x`} />
          <SummaryBox
            label="Margin Mode"
            value={isolatedCount > 0 ? `${isolatedCount} Isolated` : 'All Cross'}
            extra={
              <div className="text-[9px] text-[#474d57] mt-0.5">
                {collaterals.join(' / ')}
              </div>
            }
          />
        </div>
      </div>

      {/* ── Main table ── */}
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2b3139] flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Current Positions</h3>
          <span className="text-[#848e9c] text-xs">{positions.length} active</span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[#848e9c] text-xs border-b border-[#2b3139]">
                <th className="text-left px-5 py-3 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('symbol')}>
                  Symbol{sortIcon('symbol')}
                </th>
                <th className="text-left px-3 py-3 font-medium">Side</th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('size')}>
                  Size{sortIcon('size')}
                </th>
                <th className="text-right px-3 py-3 font-medium">Entry</th>
                <th className="text-right px-3 py-3 font-medium">Mark</th>
                <th className="text-right px-3 py-3 font-medium">Break-Even</th>
                <th className="text-center px-3 py-3 font-medium">Mode</th>
                <th className="text-center px-3 py-3 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('leverage')}>
                  Lev.{sortIcon('leverage')}
                </th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('pnl')}>
                  PnL{sortIcon('pnl')}
                </th>
                <th className="text-right px-3 py-3 font-medium">PnL %</th>
                <th className="text-right px-3 py-3 font-medium">Realized</th>
                <th className="text-center px-3 py-3 font-medium">ADL</th>
                <th className="text-right px-3 py-3 font-medium cursor-pointer hover:text-white select-none" onClick={() => toggleSort('notional')}>
                  Notional{sortIcon('notional')}
                </th>
                <th className="text-center px-3 py-3 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((pos) => {
                const isExpanded = expandedRow === pos.id;
                return (
                  <PositionRows key={pos.id} pos={pos} isExpanded={isExpanded} onToggle={() => setExpandedRow(isExpanded ? null : pos.id)} />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#2b3139]">
          {sorted.map((pos) => (
            <div key={pos.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{pos.base}/{pos.collateral}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    pos.isLong ? 'bg-[#0ecb81]/15 text-[#0ecb81]' : 'bg-[#f6465d]/15 text-[#f6465d]'
                  }`}>{pos.side}</span>
                  <span className="text-[#f0b90b] text-[10px] font-semibold">{pos.leverage}x</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded border ${
                    pos.isolated ? 'border-[#f0b90b]/30 text-[#f0b90b]' : 'border-[#474d57] text-[#474d57]'
                  }`}>{pos.isolated ? 'ISO' : 'Cross'}</span>
                </div>
                <span className={`font-mono font-medium text-sm ${pos.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-[#848e9c]">Size</div>
                  <div className="text-white font-mono">{pos.absAmt.toLocaleString('en', { maximumFractionDigits: 4 })}</div>
                </div>
                <div>
                  <div className="text-[#848e9c]">Entry</div>
                  <div className="text-white font-mono">{formatPrice(pos.entry)}</div>
                </div>
                <div>
                  <div className="text-[#848e9c]">Mark</div>
                  <div className={`font-mono ${pos.mark > pos.entry === pos.isLong ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                    {formatPrice(pos.mark)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-[#848e9c]">PnL %</div>
                  <div className={`font-mono ${pos.pnlPercent >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                    {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[#848e9c]">Realized</div>
                  <div className={`font-mono ${pos.cumRealized >= 0 ? 'text-[#0ecb81]/70' : 'text-[#f6465d]/70'}`}>
                    {pos.cumRealized !== 0 ? `${pos.cumRealized >= 0 ? '+' : ''}${pos.cumRealized.toFixed(2)}` : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[#848e9c]">Notional</div>
                  <div className="text-white font-mono">${Math.abs(pos.notional).toLocaleString('en', { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#2b3139]/60">
                <div className="flex items-center gap-2 text-[10px] text-[#474d57]">
                  <span>ADL:</span>
                  <AdlIndicator level={pos.adl} />
                </div>
                <div className="text-[10px] text-[#474d57]">
                  BE: <span className="text-[#848e9c] font-mono">{pos.breakEven > 0 ? formatPrice(pos.breakEven) : '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── sub-components ── */

interface ParsedPosition extends Position {
  amt: number; entry: number; mark: number; pnl: number; notional: number;
  cumRealized: number; breakEven: number; askNotional: number; bidNotional: number;
  isolatedWallet: number; side: string; isLong: boolean; absAmt: number;
  pnlPercent: number; base: string; collateral: string;
}

function PositionRows({ pos, isExpanded, onToggle }: { pos: ParsedPosition; isExpanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`border-b border-[#2b3139] last:border-b-0 hover:bg-[#2b3139]/50 transition-colors ${isExpanded ? 'bg-[#2b3139]/30' : ''}`}>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium text-sm">{pos.base}</span>
            <span className="text-[#474d57] text-xs">/{pos.collateral}</span>
          </div>
        </td>
        <td className="px-3 py-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
            pos.isLong ? 'bg-[#0ecb81]/15 text-[#0ecb81]' : 'bg-[#f6465d]/15 text-[#f6465d]'
          }`}>
            {pos.side}
          </span>
        </td>
        <td className="px-3 py-3 text-right text-white text-sm font-mono">
          {pos.absAmt.toLocaleString('en', { maximumFractionDigits: 4 })}
        </td>
        <td className="px-3 py-3 text-right text-white text-sm font-mono">
          {formatPrice(pos.entry)}
        </td>
        <td className="px-3 py-3 text-right text-sm font-mono">
          <span className={pos.mark > pos.entry === pos.isLong ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
            {formatPrice(pos.mark)}
          </span>
        </td>
        <td className="px-3 py-3 text-right text-[#848e9c] text-sm font-mono">
          {pos.breakEven > 0 ? formatPrice(pos.breakEven) : '-'}
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
            pos.isolated
              ? 'border-[#f0b90b]/30 text-[#f0b90b] bg-[#f0b90b]/10'
              : 'border-[#474d57] text-[#848e9c]'
          }`}>
            {pos.isolated ? 'Isolated' : 'Cross'}
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          <span className="text-[#f0b90b] text-xs font-semibold bg-[#f0b90b]/10 px-2 py-0.5 rounded">
            {pos.leverage}x
          </span>
        </td>
        <td className={`px-3 py-3 text-right text-sm font-mono font-medium ${
          pos.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
        }`}>
          {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
        </td>
        <td className={`px-3 py-3 text-right text-sm font-mono ${
          pos.pnlPercent >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'
        }`}>
          {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
        </td>
        <td className={`px-3 py-3 text-right text-xs font-mono ${
          pos.cumRealized >= 0 ? 'text-[#0ecb81]/70' : 'text-[#f6465d]/70'
        }`}>
          {pos.cumRealized !== 0 ? `${pos.cumRealized >= 0 ? '+' : ''}${pos.cumRealized.toFixed(2)}` : '-'}
        </td>
        <td className="px-3 py-3 text-center">
          <AdlIndicator level={pos.adl} />
        </td>
        <td className="px-3 py-3 text-right text-[#848e9c] text-sm font-mono">
          ${Math.abs(pos.notional).toLocaleString('en', { maximumFractionDigits: 0 })}
        </td>
        <td className="px-3 py-3 text-center">
          <button
            onClick={onToggle}
            className="text-[#474d57] hover:text-white transition-colors text-xs"
            title="Details"
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-[#181c21]">
          <td colSpan={14} className="px-5 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
              <DetailItem label="Position ID" value={pos.id} mono />
              <DetailItem label="Collateral" value={pos.collateral} />
              <DetailItem label="Ask Notional" value={pos.askNotional ? `$${pos.askNotional.toLocaleString('en', { maximumFractionDigits: 2 })}` : '-'} />
              <DetailItem label="Bid Notional" value={pos.bidNotional ? `$${pos.bidNotional.toLocaleString('en', { maximumFractionDigits: 2 })}` : '-'} />
              <DetailItem label="Isolated Wallet" value={pos.isolatedWallet ? `$${pos.isolatedWallet.toLocaleString('en', { maximumFractionDigits: 2 })}` : '-'} />
              <DetailItem label="Position Side (raw)" value={pos.positionSide} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SummaryBox({ label, value, color, extra }: { label: string; value: string; color?: 'green' | 'red' | 'gold'; extra?: React.ReactNode }) {
  const colorClass = color === 'green' ? 'text-[#0ecb81]' : color === 'red' ? 'text-[#f6465d]' : color === 'gold' ? 'text-[#f0b90b]' : 'text-white';
  return (
    <div>
      <div className="text-[#474d57] text-[10px] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-semibold font-mono ${colorClass}`}>{value}</div>
      {extra}
    </div>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[#474d57] mb-0.5">{label}</div>
      <div className={`text-[#b7bdc6] ${mono ? 'font-mono text-[10px] break-all' : ''}`}>{value}</div>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price === 0) return '-';
  if (price >= 1000) return price.toLocaleString('en', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function AdlIndicator({ level }: { level: number }) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`w-1 h-3 rounded-sm ${
            n <= level
              ? level >= 4 ? 'bg-[#f6465d]' : level >= 3 ? 'bg-[#f0b90b]' : 'bg-[#0ecb81]'
              : 'bg-[#474d57]'
          }`}
        />
      ))}
    </div>
  );
}
