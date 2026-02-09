'use client';

import type { TraderPayload } from '@/lib/api';

interface PerformanceStatsProps {
  payload: TraderPayload;
  performance?: {
    roi?: number;
    pnl?: number;
    mdd?: number;
    winRate?: number;
    copierPnl?: number;
    winOrders?: number;
    totalOrder?: number;
    sharpRatio?: number;
  } | null;
}

export function PerformanceStats({ payload, performance }: PerformanceStatsProps) {
  const p = payload.portfolioDetail;
  const positions = payload.activePositions || [];

  // Calculate derived stats from positions
  const totalNotional = positions.reduce((s, pos) => s + Math.abs(parseFloat(String(pos.notionalValue || '0'))), 0);
  const totalPnl = positions.reduce((s, pos) => s + parseFloat(String(pos.unrealizedProfit || '0')), 0);
  const longCount = positions.filter((pos) => {
    const amt = parseFloat(String(pos.positionAmount));
    return pos.positionSide === 'LONG' || (pos.positionSide === 'BOTH' && amt > 0);
  }).length;
  const shortCount = positions.length - longCount;

  const avgLeverage = positions.length > 0
    ? positions.reduce((s, pos) => s + pos.leverage, 0) / positions.length
    : 0;
  const maxLeverage = positions.length > 0
    ? Math.max(...positions.map((pos) => pos.leverage))
    : 0;

  const marginBalance = parseFloat(String(p?.marginBalance || '0'));

  const roi = performance?.roi;
  const pnl = performance?.pnl;
  const mdd = performance?.mdd;
  const winRate = performance?.winRate;
  const winOrders = performance?.winOrders;
  const totalOrder = performance?.totalOrder;
  const sharpRatio = parseFloat(String(performance?.sharpRatio ?? p?.sharpRatio ?? '0')) || 0;

  return (
    <div className="space-y-4">
      {/* Performance metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="30D ROI"
          value={roi !== undefined && roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%` : '-'}
          positive={roi !== undefined && roi !== null && roi >= 0}
          large
        />
        <StatCard
          label="30D PnL"
          value={pnl !== undefined && pnl !== null ? `$${Math.abs(pnl).toLocaleString('en', { maximumFractionDigits: 2 })}` : '-'}
          prefix={pnl !== undefined && pnl !== null ? (pnl >= 0 ? '+' : '-') : undefined}
          positive={pnl !== undefined && pnl !== null && pnl >= 0}
          large
        />
        <StatCard
          label="Max Drawdown"
          value={mdd !== undefined && mdd !== null ? `${mdd.toFixed(2)}%` : '-'}
          negative
        />
        <StatCard
          label="Win Rate"
          value={winRate !== undefined && winRate !== null ? `${winRate.toFixed(0)}%` : '-'}
          subtitle={winOrders !== undefined && totalOrder !== undefined ? `${winOrders} wins / ${totalOrder} trades` : undefined}
        />
      </div>

      {/* Position analysis */}
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Position Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MiniStat label="Active Positions" value={String(positions.length)} />
          <MiniStat label="Long / Short" value={`${longCount} / ${shortCount}`} />
          <MiniStat label="Unrealized PnL" value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`} positive={totalPnl >= 0} />
          <MiniStat label="Avg Leverage" value={`${avgLeverage.toFixed(0)}x`} />
          <MiniStat label="Max Leverage" value={`${maxLeverage}x`} highlight={maxLeverage >= 50} />
        </div>

        {/* Long/Short bar */}
        {positions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-[#848e9c] mb-1.5">
              <span>Long {longCount}</span>
              <span>Short {shortCount}</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-[#2b3139]">
              <div
                className="bg-[#0ecb81] transition-all"
                style={{ width: `${positions.length > 0 ? (longCount / positions.length) * 100 : 50}%` }}
              />
              <div
                className="bg-[#f6465d] transition-all"
                style={{ width: `${positions.length > 0 ? (shortCount / positions.length) * 100 : 50}%` }}
              />
            </div>
          </div>
        )}

        {/* Notional exposure */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#2b3139] text-sm">
          <span className="text-[#848e9c]">Total Notional Exposure</span>
          <span className="text-white font-mono font-medium">${totalNotional.toLocaleString('en', { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-[#848e9c]">Exposure / Balance Ratio</span>
          <span className={`font-mono font-medium ${totalNotional / marginBalance > 10 ? 'text-[#f6465d]' : totalNotional / marginBalance > 5 ? 'text-[#f0b90b]' : 'text-[#0ecb81]'}`}>
            {marginBalance > 0 ? `${(totalNotional / marginBalance).toFixed(1)}x` : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-[#848e9c]">Sharpe Ratio</span>
          <span className={`font-mono font-medium ${sharpRatio >= 2 ? 'text-[#0ecb81]' : sharpRatio >= 1 ? 'text-[#f0b90b]' : 'text-[#f6465d]'}`}>
            {sharpRatio.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  prefix,
  positive,
  negative,
  large,
  subtitle,
}: {
  label: string;
  value: string;
  prefix?: string;
  positive?: boolean;
  negative?: boolean;
  large?: boolean;
  subtitle?: string;
}) {
  let color = 'text-white';
  if (positive) color = 'text-[#0ecb81]';
  if (negative) color = 'text-[#f6465d]';

  return (
    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-4">
      <div className="text-[#848e9c] text-xs mb-2">{label}</div>
      <div className={`${large ? 'text-xl' : 'text-lg'} font-bold font-mono ${color}`}>
        {prefix}{value}
      </div>
      {subtitle && <div className="text-[#848e9c] text-[10px] mt-1">{subtitle}</div>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  positive,
  highlight,
}: {
  label: string;
  value: string;
  positive?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[#848e9c] text-[11px] mb-1">{label}</div>
      <div className={`text-sm font-semibold font-mono ${
        positive === true ? 'text-[#0ecb81]' : positive === false ? 'text-[#f6465d]' : highlight ? 'text-[#f0b90b]' : 'text-white'
      }`}>
        {value}
      </div>
    </div>
  );
}
