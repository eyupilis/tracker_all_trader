'use client';

import type { PortfolioDetail, TagItemVo } from '@/lib/api';

interface TraderSettingsCardProps {
  portfolio: PortfolioDetail;
}

/* ── helpers ─────────────────────────────────────────── */

function fmtDate(ts: number | null | undefined) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString('en', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtUsd(v: number | string | null | undefined) {
  const n = parseFloat(String(v ?? '0'));
  if (!Number.isFinite(n)) return '-';
  return '$' + n.toLocaleString('en', { maximumFractionDigits: 2 });
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`} />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">{children}</h3>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2b3139]/60 last:border-b-0">
      <span className="text-[#848e9c] text-sm">{label}</span>
      <span className="text-white text-sm font-medium text-right max-w-[60%] break-all">{children}</span>
    </div>
  );
}

function BoolBadge({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${value ? 'bg-[#0ecb81]/15 text-[#0ecb81] border border-[#0ecb81]/30' : 'bg-[#474d57]/30 text-[#848e9c] border border-[#474d57]'}`}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

function IdChip({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-[#474d57]">—</span>;
  return (
    <span className="font-mono text-xs bg-[#2b3139] px-2 py-1 rounded border border-[#474d57] select-all">
      {value}
    </span>
  );
}

/* ── main component ──────────────────────────────────── */

export function TraderSettingsCard({ portfolio: p }: TraderSettingsCardProps) {
  const profitShare = parseFloat(String(p.profitSharingRate || '0'));
  const rebate = parseFloat(String(p.rebateFee || '0'));
  const unrealizedShare = parseFloat(String(p.unrealizedProfitShareAmount || '0'));
  const tagItems: TagItemVo[] = Array.isArray(p.tagItemVos) ? p.tagItemVos : [];

  return (
    <div className="space-y-6">
      {/* ── Row 1: Copy Settings + Financial ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Copy Settings */}
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <SectionTitle>⚙️ Copy Settings</SectionTitle>
          <Row label="Profit Sharing Rate">{profitShare}%</Row>
          <Row label="Lock Period">{p.lockPeriod} days</Row>
          <Row label="Min Copy (Fixed Amount)">{fmtUsd(p.fixedAmountMinCopyUsd)}</Row>
          <Row label="Min Copy (Fixed Ratio)">{fmtUsd(p.fixedRadioMinCopyUsd)}</Row>
          <Row label="Copier Lock Period Time">{fmtDate(p.copierLockPeriodTime) || <span className="text-[#474d57]">Not set</span>}</Row>
          <Row label="Copier Unlock Expiry">{fmtDate(p.copierUnlockExpiredTime) || <span className="text-[#474d57]">Not set</span>}</Row>
          <Row label="Init Invest Asset"><span className="font-mono">{p.initInvestAsset || '—'}</span></Row>
          <Row label="Copier PnL Asset"><span className="font-mono">{p.copierPnlAsset || '—'}</span></Row>
        </div>

        {/* Financial Details */}
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <SectionTitle>💰 Financial Details</SectionTitle>
          <Row label="Margin Balance">{fmtUsd(p.marginBalance)}</Row>
          <Row label="AUM Amount">{fmtUsd(p.aumAmount)}</Row>
          <Row label="Copier PnL">{fmtUsd(p.copierPnl)}</Row>
          <Row label="Rebate Fee">{fmtUsd(rebate)}</Row>
          <Row label="Unrealized Profit Share">{fmtUsd(unrealizedShare)}</Row>
          <Row label="Sharpe Ratio">
            <span className="font-mono">{parseFloat(String(p.sharpRatio || '0')).toFixed(4)}</span>
          </Row>
        </div>
      </div>

      {/* ── Row 2: Copier Capacity + Status Flags ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Copier Capacity */}
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <SectionTitle>👥 Copier Capacity</SectionTitle>
          <Row label="Current Copiers">{p.currentCopyCount.toLocaleString()}</Row>
          <Row label="Max Copiers">{p.maxCopyCount.toLocaleString()}</Row>
          <Row label="Total (All-time)">{p.totalCopyCount.toLocaleString()}</Row>
          <Row label="Mock Copiers">{p.mockCopyCount.toLocaleString()}</Row>
          <Row label="Badge Copier Count">{p.badgeCopierCount.toLocaleString()}</Row>
          <Row label="Favorites">{p.favoriteCount.toLocaleString()}</Row>
          <Row label="Accepting New Copiers"><BoolBadge value={!!p.enableAddMaxCopier} trueLabel="Open" falseLabel="Closed" /></Row>
          <Row label="Effective Max Copy Count">
            {p.finalEffectiveMaxCopyCount !== null && p.finalEffectiveMaxCopyCount !== undefined
              ? p.finalEffectiveMaxCopyCount.toLocaleString()
              : <span className="text-[#474d57]">Unlimited</span>}
          </Row>
          <Row label="Risk Control Max">
            {p.riskControlMaxCopyCount !== null && p.riskControlMaxCopyCount !== undefined
              ? p.riskControlMaxCopyCount.toLocaleString()
              : <span className="text-[#474d57]">None</span>}
          </Row>

          {/* Capacity bar */}
          {p.maxCopyCount > 0 && (
            <div className="mt-4 pt-3 border-t border-[#2b3139]/60">
              <div className="flex justify-between text-xs text-[#848e9c] mb-1">
                <span>Capacity Usage</span>
                <span className="text-white">{((p.currentCopyCount / p.maxCopyCount) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-[#2b3139] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    p.currentCopyCount / p.maxCopyCount >= 0.9 ? 'bg-[#f6465d]'
                    : p.currentCopyCount / p.maxCopyCount >= 0.7 ? 'bg-[#f0b90b]'
                    : 'bg-[#0ecb81]'
                  }`}
                  style={{ width: `${Math.min((p.currentCopyCount / p.maxCopyCount) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Flags */}
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <SectionTitle>🚦 Status & Flags</SectionTitle>
          <Row label="Portfolio Status">
            <span className={`text-xs px-2 py-0.5 rounded border ${
              p.status === 'ACTIVE' ? 'border-[#0ecb81]/40 text-[#0ecb81] bg-[#0ecb81]/10' : 'border-[#f6465d]/40 text-[#f6465d] bg-[#f6465d]/10'
            }`}>
              {p.status}
            </span>
          </Row>
          <Row label="Position Visibility"><BoolBadge value={p.positionShow} trueLabel="Public" falseLabel="Hidden" /></Row>
          <Row label="Trading Signals"><BoolBadge value={!!p.enableTradingSignal} trueLabel="Enabled" falseLabel="Disabled" /></Row>
          <Row label="Sync Setting"><BoolBadge value={!!p.syncSetting} /></Row>
          <Row label="Feed Agreement"><BoolBadge value={!!p.feedAgreement} /></Row>
          <Row label="Feed Share"><BoolBadge value={!!p.feedShareSwitch} trueLabel="On" falseLabel="Off" /></Row>
          <Row label="Feed Share Push Limit">{p.feedSharePushLimit ?? '—'}</Row>
          <Row label="Lead Owner"><BoolBadge value={!!p.leadOwner} /></Row>
          <Row label="Has Copy"><BoolBadge value={!!p.hasCopy} /></Row>
          <Row label="Has Mock"><BoolBadge value={!!p.hasMock} /></Row>
          <Row label="Slot Reminder"><BoolBadge value={!!p.hasSlotReminder} /></Row>
          <Row label="Close Lead Count">{p.closeLeadCount}</Row>
          <Row label="Sync Setting Count">{p.syncSettingCount}</Row>
          <Row label="Invite Code Count">{p.inviteCodeCount}</Row>
        </div>
      </div>

      {/* ── Row 3: Portfolio IDs + Timestamps ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio IDs */}
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <SectionTitle>🔗 Portfolio Identifiers</SectionTitle>
          <Row label="Lead Portfolio ID"><IdChip value={p.leadPortfolioId} /></Row>
          <Row label="Public Portfolio ID"><IdChip value={p.publicLeadPortfolioId} /></Row>
          <Row label="Private Portfolio ID"><IdChip value={p.privateLeadPortfolioId} /></Row>
          <Row label="PGC Username">
            {p.pgcUsername
              ? <span className="text-[#f0b90b] font-mono text-xs">{p.pgcUsername}</span>
              : <span className="text-[#474d57]">—</span>}
          </Row>
          <Row label="User ID"><IdChip value={p.userId} /></Row>
          <Row label="Futures Type"><span className="font-mono">{p.futuresType}</span></Row>
          <Row label="Portfolio Type">
            <span className={`text-xs px-2 py-0.5 rounded border ${
              p.portfolioType === 'PUBLIC' ? 'border-[#0ecb81]/40 text-[#0ecb81] bg-[#0ecb81]/10' : 'border-[#f0b90b]/40 text-[#f0b90b] bg-[#f0b90b]/10'
            }`}>
              {p.portfolioType}
            </span>
          </Row>
        </div>

        {/* Timestamps */}
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <SectionTitle>🕐 Timeline</SectionTitle>
          <Row label="Started">
            <span className="flex items-center gap-2">
              <StatusDot active={true} />
              {fmtDate(p.startTime) || '—'}
            </span>
          </Row>
          <Row label="Last Trade">{fmtDate(p.lastTradeTime) || '—'}</Row>
          <Row label="Badge Modified">{fmtDate(p.badgeModifyTime) || <span className="text-[#474d57]">—</span>}</Row>
          <Row label="Closed Time">{fmtDate(p.closedTime) || <span className="text-[#0ecb81] text-xs">Active</span>}</Row>
          <Row label="End Time">{fmtDate(p.endTime) || <span className="text-[#0ecb81] text-xs">Running</span>}</Row>
          {p.startTime && p.lastTradeTime && (
            <div className="mt-4 pt-3 border-t border-[#2b3139]/60">
              <div className="text-xs text-[#848e9c] mb-2">Activity Timeline</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#0ecb81]">●</span>
                <span className="text-[#848e9c]">
                  Since {fmtDate(p.startTime)}
                </span>
                <span className="text-[#474d57]">|</span>
                <span className="text-[#848e9c]">
                  Last trade: {fmtDate(p.lastTradeTime)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Tag Details (full tagItemVos) ── */}
      {tagItems.length > 0 && (
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <SectionTitle>🏷️ Tags & Badges ({tagItems.length})</SectionTitle>
          <div className="space-y-3">
            {tagItems.map((tag, i) => (
              <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-[#181c21] border border-[#2b3139]/60">
                {/* Tag badge */}
                <div className="flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    tag.tagName === 'Top_Performer' ? 'bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/30'
                    : tag.tagName === 'API_KEY_TRADE' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : tag.tagName.includes('LEVERAGE') ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    : 'bg-[#2b3139] text-[#b7bdc6] border border-[#474d57]'
                  }`}>
                    {tag.tagLangKeyMessage || tag.tagName}
                  </span>
                </div>

                {/* Tag details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium">{tag.tagName}</span>
                    <span className="text-[#474d57] text-xs">sort: {tag.sort}</span>
                  </div>

                  {/* Description */}
                  {tag.descLangKeyMessage && (
                    <p className="text-[#848e9c] text-xs mb-1">{tag.descLangKeyMessage}</p>
                  )}

                  {/* Describe params */}
                  {tag.describeParams && Object.keys(tag.describeParams).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {Object.entries(tag.describeParams).map(([k, v]) => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2b3139] text-[#b7bdc6] font-mono">
                          {k}={v}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Lang keys */}
                  <div className="flex gap-3 mt-1.5 text-[10px] text-[#474d57] font-mono">
                    <span>lang: {tag.tagLangKey}</span>
                    <span>desc: {tag.descLangKey}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Description / Translation ── */}
      {(p.description || p.descTranslate) && (
        <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
          <SectionTitle>📝 Description</SectionTitle>
          {p.description && (
            <div className="mb-3">
              <div className="text-[#474d57] text-xs mb-1">Original</div>
              <p className="text-[#b7bdc6] text-sm whitespace-pre-wrap leading-relaxed">{p.description}</p>
            </div>
          )}
          {p.descTranslate && (
            <div className="pt-3 border-t border-[#2b3139]/60">
              <div className="text-[#474d57] text-xs mb-1">Translated</div>
              <p className="text-[#b7bdc6] text-sm whitespace-pre-wrap leading-relaxed">{p.descTranslate}</p>
            </div>
          )}
          {p.nicknameTranslate && (
            <div className="pt-3 border-t border-[#2b3139]/60">
              <div className="text-[#474d57] text-xs mb-1">Nickname (Translated)</div>
              <p className="text-white text-sm font-medium">{p.nicknameTranslate}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
