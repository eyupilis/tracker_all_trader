'use client';

import type { LeadCommon } from '@/lib/api';

interface PlatformStatusCardProps {
  leadCommon: LeadCommon;
  leadId: string;
}

/* ── helpers ─────────────────────────────────────────── */

function StatusIndicator({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[#474d57]">
        <span className="w-2 h-2 rounded-full bg-[#474d57]" />
        N/A
      </span>
    );
  }

  const isActive = status === 'ACTIVE';
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#0ecb81] animate-pulse' : 'bg-[#f6465d]'}`} />
      {status}
    </span>
  );
}

function PortfolioSlot({
  label,
  icon,
  id,
  status,
  isMain,
}: {
  label: string;
  icon: string;
  id: string | null | undefined;
  status: string | null | undefined;
  isMain?: boolean;
}) {
  const hasData = !!id;

  return (
    <div className={`relative rounded-xl border p-4 transition-all ${
      hasData
        ? isMain
          ? 'bg-[#1a1f25] border-[#f0b90b]/30 shadow-[0_0_15px_rgba(240,185,11,0.05)]'
          : 'bg-[#1a1f25] border-[#2b3139] hover:border-[#474d57]'
        : 'bg-[#181c21] border-[#2b3139]/50 opacity-50'
    }`}>
      {/* Main portfolio indicator */}
      {isMain && (
        <div className="absolute -top-2 left-4">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#f0b90b] text-[#0b0e11] font-bold uppercase tracking-wider">
            Primary
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-white text-sm font-medium">{label}</span>
        </div>
        <StatusIndicator status={status} />
      </div>

      {hasData ? (
        <div className="space-y-2">
          <div>
            <div className="text-[#474d57] text-[10px] uppercase tracking-wider mb-1">Portfolio ID</div>
            <div className="font-mono text-xs text-[#b7bdc6] bg-[#0b0e11] px-2.5 py-1.5 rounded border border-[#2b3139] select-all break-all">
              {id}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[#474d57] text-xs italic">Not configured</div>
      )}
    </div>
  );
}

/* ── main component ──────────────────────────────────── */

export function PlatformStatusCard({ leadCommon, leadId }: PlatformStatusCardProps) {
  const lc = leadCommon;

  const activeCount = [
    lc.futuresPublicLPStatus,
    lc.futuresPrivateLPStatus,
    lc.spotPublicLPStatus,
    lc.spotPrivateLPStatus,
  ].filter((s) => s === 'ACTIVE').length;

  const totalSlots = 4;
  const configuredCount = [
    lc.futuresPublicLPId,
    lc.futuresPrivateLPId,
    lc.spotPublicLPId,
    lc.spotPrivateLPId,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-[#1e2329] rounded-xl border border-[#2b3139] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            🌐 Platform Status
          </h3>
          <div className="flex items-center gap-3">
            {/* Lead Owner badge */}
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
              lc.leadOwner
                ? 'bg-[#f0b90b]/15 text-[#f0b90b] border-[#f0b90b]/30'
                : 'bg-[#2b3139] text-[#848e9c] border-[#474d57]'
            }`}>
              {lc.leadOwner ? '👑 Lead Owner' : 'Follower'}
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-[#0b0e11] rounded-lg p-3 text-center">
            <div className="text-[#848e9c] text-[10px] uppercase tracking-wider mb-1">Active Portfolios</div>
            <div className="text-white text-xl font-bold">
              {activeCount}<span className="text-[#474d57] text-sm font-normal">/{totalSlots}</span>
            </div>
          </div>
          <div className="bg-[#0b0e11] rounded-lg p-3 text-center">
            <div className="text-[#848e9c] text-[10px] uppercase tracking-wider mb-1">Configured</div>
            <div className="text-white text-xl font-bold">
              {configuredCount}<span className="text-[#474d57] text-sm font-normal">/{totalSlots}</span>
            </div>
          </div>
          <div className="bg-[#0b0e11] rounded-lg p-3 text-center">
            <div className="text-[#848e9c] text-[10px] uppercase tracking-wider mb-1">Markets</div>
            <div className="text-white text-xl font-bold">
              {[lc.futuresPublicLPId || lc.futuresPrivateLPId ? 'Futures' : null, lc.spotPublicLPId || lc.spotPrivateLPId ? 'Spot' : null].filter(Boolean).length || 0}
            </div>
          </div>
        </div>

        {/* Portfolio activity bar */}
        <div className="mb-1">
          <div className="flex justify-between text-[10px] text-[#848e9c] mb-1.5">
            <span>Portfolio Utilization</span>
            <span className="text-white">{activeCount}/{totalSlots} active</span>
          </div>
          <div className="flex gap-1">
            {[
              { status: lc.futuresPublicLPStatus, label: 'F-Pub' },
              { status: lc.futuresPrivateLPStatus, label: 'F-Priv' },
              { status: lc.spotPublicLPStatus, label: 'S-Pub' },
              { status: lc.spotPrivateLPStatus, label: 'S-Priv' },
            ].map((slot) => (
              <div key={slot.label} className="flex-1 group relative">
                <div className={`h-3 rounded-sm transition-all ${
                  slot.status === 'ACTIVE' ? 'bg-[#0ecb81]'
                  : slot.status ? 'bg-[#f6465d]'
                  : 'bg-[#2b3139]'
                }`} />
                <div className="text-[8px] text-center mt-1 text-[#474d57]">{slot.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Futures */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[#f0b90b] text-xs font-semibold uppercase tracking-wider">Futures</span>
            <div className="flex-1 h-px bg-[#2b3139]" />
          </div>
          <PortfolioSlot
            label="Public Portfolio"
            icon="📊"
            id={lc.futuresPublicLPId}
            status={lc.futuresPublicLPStatus}
            isMain={lc.futuresPublicLPId === leadId}
          />
          <PortfolioSlot
            label="Private Portfolio"
            icon="🔒"
            id={lc.futuresPrivateLPId}
            status={lc.futuresPrivateLPStatus}
          />
        </div>

        {/* Spot */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[#0ecb81] text-xs font-semibold uppercase tracking-wider">Spot</span>
            <div className="flex-1 h-px bg-[#2b3139]" />
          </div>
          <PortfolioSlot
            label="Public Portfolio"
            icon="💱"
            id={lc.spotPublicLPId}
            status={lc.spotPublicLPStatus}
          />
          <PortfolioSlot
            label="Private Portfolio"
            icon="🔐"
            id={lc.spotPrivateLPId}
            status={lc.spotPrivateLPStatus}
          />
        </div>
      </div>

      {/* Raw data reference */}
      <div className="bg-[#181c21] rounded-lg border border-[#2b3139]/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[#474d57] text-xs">Lead Portfolio ID</span>
          <span className="font-mono text-xs text-[#848e9c] select-all">{leadId}</span>
        </div>
      </div>
    </div>
  );
}
