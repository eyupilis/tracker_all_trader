'use client';

import type { PortfolioDetail, LeadCommon, TagItemVo } from '@/lib/api';

interface TraderProfileHeaderProps {
  portfolio: PortfolioDetail;
  leadId: string;
  leadCommon?: LeadCommon | null;
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

export function TraderProfileHeader({ portfolio, leadId, leadCommon, performance }: TraderProfileHeaderProps) {
  const p = portfolio;
  const lc = leadCommon;
  const nickname = p.nickname || `Trader ${leadId.slice(-6)}`;
  const marginBalance = parseFloat(String(p.marginBalance || '0'));
  const aumAmount = parseFloat(String(p.aumAmount || '0'));
  const copierPnl = parseFloat(String(p.copierPnl || '0'));
  const profitSharingRate = parseFloat(String(p.profitSharingRate || '0'));
  const sharpRatio = parseFloat(String(performance?.sharpRatio ?? p.sharpRatio ?? '0'));

  const roi = performance?.roi;
  const pnl = performance?.pnl;
  const mdd = performance?.mdd;
  const winRate = performance?.winRate;
  const winOrders = performance?.winOrders;
  const totalOrder = performance?.totalOrder;

  const tags = Array.isArray(p.tag) ? p.tag : [];
  const tagVos: TagItemVo[] = Array.isArray(p.tagItemVos)
    ? [...p.tagItemVos].sort((a, b) => a.sort - b.sort)
    : [];

  const badgeStyles: Record<string, string> = {
    CHAMPION: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white',
    MASTER: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white',
    DIAMOND: 'bg-gradient-to-r from-cyan-400 to-cyan-500 text-white',
    GOLD: 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white',
  };

  const tagLabels: Record<string, string> = {
    HIGH_LEVERAGE: 'High Leverage',
    LOW_RISK: 'Low Risk',
    STABLE: 'Stable',
    HIGH_FREQUENCY: 'High Freq',
  };

  return (
    <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] overflow-hidden">
      {/* Top gradient bar */}
      <div className="h-1 bg-gradient-to-r from-[#f0b90b] via-[#f0b90b]/60 to-transparent" />

      <div className="p-6">
        {/* Profile row */}
        <div className="flex items-start gap-4 mb-6">
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt={nickname} className="w-16 h-16 rounded-full border-2 border-[#f0b90b]/40" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#f0b90b]/20 flex items-center justify-center text-[#f0b90b] font-bold text-2xl">
              {nickname.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{nickname}</h1>
              {p.badgeName && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyles[p.badgeName] || 'bg-slate-600 text-white'}`}>
                  {p.badgeName}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded border ${
                p.status === 'ACTIVE' ? 'border-[#0ecb81]/40 text-[#0ecb81] bg-[#0ecb81]/10' : 'border-[#848e9c]/40 text-[#848e9c]'
              }`}>
                {p.status}
              </span>
            </div>
            {p.description && (
              <p className="text-[#848e9c] text-sm line-clamp-2 mb-2 max-w-lg">{p.description}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {tagVos.length > 0 ? (
                tagVos.map((tv) => (
                  <span
                    key={tv.tagName}
                    className="text-[10px] px-2 py-0.5 rounded bg-[#2b3139] text-[#b7bdc6] border border-[#474d57] group relative cursor-default"
                    title={tv.descLangKeyMessage || tv.enDescribe || tv.tagName}
                  >
                    {tv.tagLangKeyMessage || tagLabels[tv.tagName] || tv.tagName}
                    {tv.descLangKeyMessage && (
                      <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#0b0e11] border border-[#474d57] rounded text-[#b7bdc6] text-[10px] whitespace-nowrap z-20">
                        {tv.descLangKeyMessage}
                      </span>
                    )}
                  </span>
                ))
              ) : (
                tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-[#2b3139] text-[#b7bdc6] border border-[#474d57]">
                    {tagLabels[tag] || tag}
                  </span>
                ))
              )}
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#2b3139] text-[#b7bdc6] border border-[#474d57]">
                {profitSharingRate}% Profit Share
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#2b3139] text-[#b7bdc6] border border-[#474d57]">
                {p.lockPeriod}D Lock
              </span>
            </div>
          </div>
          {/* Copier stats */}
          <div className="text-right hidden md:block">
            <div className="text-[#848e9c] text-xs">Copiers</div>
            <div className="text-white font-bold text-lg">{p.currentCopyCount}<span className="text-[#848e9c] text-sm font-normal">/{p.maxCopyCount}</span></div>
            <div className="text-[#848e9c] text-xs mt-1">
              {p.favoriteCount} favorites • {p.mockCopyCount} mock
            </div>
          </div>
        </div>

        {/* Key performance metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pt-4 border-t border-[#2b3139]">
          <MetricBox
            label="30D ROI"
            value={roi !== undefined && roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%` : '-'}
            highlight
            positive={roi !== undefined && roi !== null && roi >= 0}
          />
          <MetricBox
            label="30D PnL"
            value={pnl !== undefined && pnl !== null ? `$${Math.abs(pnl).toLocaleString('en', { maximumFractionDigits: 0 })}` : '-'}
            positive={pnl !== undefined && pnl !== null && pnl >= 0}
            prefix={pnl !== undefined && pnl !== null ? (pnl >= 0 ? '+' : '-') : ''}
          />
          <MetricBox
            label="Max Drawdown"
            value={mdd !== undefined && mdd !== null ? `${mdd.toFixed(2)}%` : '-'}
            negative
          />
          <MetricBox
            label="Win Rate"
            value={winRate !== undefined && winRate !== null
              ? `${winRate.toFixed(0)}%`
              : '-'}
            subtitle={winOrders !== undefined && totalOrder !== undefined ? `${winOrders}/${totalOrder}` : undefined}
          />
          <MetricBox
            label="Sharpe Ratio"
            value={sharpRatio.toFixed(2)}
          />
          <MetricBox
            label="Copier PnL"
            value={`$${Math.abs(copierPnl).toLocaleString('en', { maximumFractionDigits: 0 })}`}
            prefix={copierPnl >= 0 ? '+' : '-'}
            positive={copierPnl >= 0}
          />
        </div>

        {/* Fund info bar */}
        <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-[#2b3139] text-xs text-[#848e9c]">
          <div>
            <span className="mr-1">Balance:</span>
            <span className="text-white font-medium">${marginBalance.toLocaleString('en', { maximumFractionDigits: 0 })}</span>
          </div>
          <div>
            <span className="mr-1">AUM:</span>
            <span className="text-white font-medium">${aumAmount.toLocaleString('en', { maximumFractionDigits: 0 })}</span>
          </div>
          <div>
            <span className="mr-1">Started:</span>
            <span className="text-white">{p.startTime ? new Date(p.startTime).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</span>
          </div>
          <div>
            <span className="mr-1">Last Trade:</span>
            <span className="text-white">{p.lastTradeTime ? new Date(p.lastTradeTime).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
          </div>
          <div>
            <span className="mr-1">Type:</span>
            <span className="text-white">{p.futuresType} {p.portfolioType}</span>
          </div>
          {/* Platform status from leadCommon */}
          {lc && (
            <>
              <div className="w-px h-4 bg-[#2b3139]" />
              {lc.futuresPublicLPStatus && (
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${lc.futuresPublicLPStatus === 'ACTIVE' ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#f6465d]'}`} />
                  <span className="text-[#848e9c]">Futures</span>
                  <span className={lc.futuresPublicLPStatus === 'ACTIVE' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{lc.futuresPublicLPStatus}</span>
                </div>
              )}
              {lc.spotPublicLPStatus && (
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${lc.spotPublicLPStatus === 'ACTIVE' ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#f6465d]'}`} />
                  <span className="text-[#848e9c]">Spot</span>
                  <span className={lc.spotPublicLPStatus === 'ACTIVE' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{lc.spotPublicLPStatus}</span>
                </div>
              )}
              {lc.leadOwner && (
                <div className="flex items-center gap-1">
                  <span className="text-[#f0b90b]">👑</span>
                  <span className="text-[#f0b90b]">Owner</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  positive,
  negative,
  highlight,
  prefix,
  subtitle,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  highlight?: boolean;
  prefix?: string;
  subtitle?: string;
}) {
  let valueColor = 'text-white';
  if (positive) valueColor = 'text-[#0ecb81]';
  if (negative) valueColor = 'text-[#f6465d]';

  return (
    <div>
      <div className="text-[#848e9c] text-[11px] mb-1">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-lg' : 'text-sm'} ${valueColor}`}>
        {prefix}{value}
      </div>
      {subtitle && <div className="text-[#848e9c] text-[10px] mt-0.5">{subtitle}</div>}
    </div>
  );
}
