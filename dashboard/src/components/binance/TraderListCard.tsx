'use client';

import Link from 'next/link';
import type { PortfolioDetail, PerformanceData, Position } from '@/lib/api';

interface TraderListCardProps {
  leadId: string;
  portfolio: PortfolioDetail | null;
  performance: PerformanceData | null;
  positions: Position[];
}

export function TraderListCard({ leadId, portfolio, performance, positions }: TraderListCardProps) {
  const p = portfolio;
  if (!p) {
    // Fallback card when portfolio data isn't available yet
    return (
      <Link href={`/traders/${leadId}`}>
        <div className="group bg-[#1e2329] hover:bg-[#2b3139] border border-[#2b3139] hover:border-[#f0b90b]/40 rounded-xl p-5 transition-all duration-200 cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#f0b90b]/20 flex items-center justify-center text-[#f0b90b] font-bold text-sm">
              {leadId.slice(-2)}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-white font-semibold text-sm">Trader ...{leadId.slice(-6)}</span>
              <div className="text-xs text-[#848e9c]">Loading data...</div>
            </div>
          </div>
          {performance && (
            <div className="mb-4">
              <div className="text-[#848e9c] text-xs mb-1">30D ROI</div>
              <div className={`text-2xl font-bold ${performance.roi >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {performance.roi >= 0 ? '+' : ''}{performance.roi.toFixed(2)}%
              </div>
            </div>
          )}
        </div>
      </Link>
    );
  }

  const roiVal = performance?.roi ?? null;
  const pnlVal = performance?.pnl ?? null;
  const mddVal = performance?.mdd ?? null;
  const winRateVal = performance?.winRate ?? null;

  const marginBalance = parseFloat(String(p.marginBalance || '0'));
  const aumAmount = parseFloat(String(p.aumAmount || '0'));
  const sharpRatio = performance?.sharpRatio ?? parseFloat(String(p.sharpRatio || '0'));
  const profitSharingRate = parseFloat(String(p.profitSharingRate || '0'));

  const positionCount = positions?.length || 0;
  const nickname = p.nickname || `Trader ${leadId.slice(-6)}`;

  const badgeColor: Record<string, string> = {
    CHAMPION: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    MASTER: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    DIAMOND: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    GOLD: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  return (
    <Link href={`/traders/${leadId}`}>
      <div className="group bg-[#1e2329] hover:bg-[#2b3139] border border-[#2b3139] hover:border-[#f0b90b]/40 rounded-xl p-5 transition-all duration-200 cursor-pointer">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {p.avatarUrl ? (
            <img
              src={p.avatarUrl}
              alt={nickname}
              className="w-10 h-10 rounded-full border-2 border-[#f0b90b]/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#f0b90b]/20 flex items-center justify-center text-[#f0b90b] font-bold text-sm">
              {nickname.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm truncate">{nickname}</span>
              {p.badgeName && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeColor[p.badgeName] || 'bg-slate-600/30 text-slate-400 border-slate-500/30'}`}>
                  {p.badgeName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#848e9c]">
              <span>{p.currentCopyCount}/{p.maxCopyCount} copiers</span>
              <span>•</span>
              <span>{profitSharingRate}% share</span>
            </div>
          </div>
          {/* Status dot */}
          <div className={`w-2 h-2 rounded-full ${p.status === 'ACTIVE' ? 'bg-[#0ecb81]' : 'bg-[#848e9c]'}`} />
        </div>

        {/* ROI highlight */}
        <div className="mb-4">
          <div className="text-[#848e9c] text-xs mb-1">30D ROI</div>
          <div className={`text-2xl font-bold ${roiVal !== null && roiVal >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            {roiVal !== null ? `${roiVal >= 0 ? '+' : ''}${roiVal.toFixed(2)}%` : '-'}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-[#848e9c] text-[11px]">30D PnL</div>
            <div className={`text-sm font-medium ${pnlVal !== null && pnlVal >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {pnlVal !== null ? `${pnlVal >= 0 ? '+' : ''}$${Math.abs(pnlVal).toLocaleString('en', { maximumFractionDigits: 0 })}` : '-'}
            </div>
          </div>
          <div>
            <div className="text-[#848e9c] text-[11px]">MDD</div>
            <div className="text-sm font-medium text-[#f6465d]">
              {mddVal !== null ? `${mddVal.toFixed(2)}%` : '-'}
            </div>
          </div>
          <div>
            <div className="text-[#848e9c] text-[11px]">Win Rate</div>
            <div className="text-sm font-medium text-white">
              {winRateVal !== null ? `${winRateVal.toFixed(0)}%` : '-'}
            </div>
          </div>
          <div>
            <div className="text-[#848e9c] text-[11px]">Sharpe</div>
            <div className="text-sm font-medium text-white">{typeof sharpRatio === 'number' ? sharpRatio.toFixed(2) : '-'}</div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between pt-3 border-t border-[#2b3139]">
          <div className="flex items-center gap-3 text-xs text-[#848e9c]">
            <span>AUM: ${aumAmount >= 1000 ? `${(aumAmount / 1000).toFixed(1)}K` : aumAmount.toFixed(0)}</span>
            <span>Bal: ${marginBalance >= 1000 ? `${(marginBalance / 1000).toFixed(1)}K` : marginBalance.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${positionCount > 0 ? 'bg-[#0ecb81]' : 'bg-[#848e9c]'}`} />
            <span className="text-xs text-[#848e9c]">{positionCount} pos</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
