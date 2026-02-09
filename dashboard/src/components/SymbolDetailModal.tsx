'use client';

import { useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SignalsFeedItem, SymbolDetail, formatNumber, formatPrice } from '@/lib/api';
import Link from 'next/link';

interface SymbolDetailModalProps {
    symbol: string;
    detail: SymbolDetail | null;
    feed: SignalsFeedItem[];
    isLoading: boolean;
    isFeedLoading: boolean;
    onClose: () => void;
    timeRange: string;
}

function WeightBadge({ weight }: { weight: number | null }) {
    if (weight === null || weight === undefined) {
        return <span className="text-[10px] text-slate-600">--</span>;
    }
    const pct = Math.round(weight * 100);
    const color =
        pct >= 60 ? 'text-green-400 border-green-500/40' :
        pct >= 30 ? 'text-yellow-400 border-yellow-500/40' :
        'text-slate-400 border-slate-600';
    return (
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>
            W:{pct}%
        </Badge>
    );
}

function ScoreBadge({
    qualityScore,
    winRate,
    confidence,
}: {
    qualityScore: number | null;
    winRate: number | null;
    confidence: 'low' | 'medium' | 'high' | null;
}) {
    return (
        <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-cyan-600/40 text-cyan-400">
                Q:{qualityScore ?? '--'}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-indigo-600/40 text-indigo-300">
                WR:{winRate === null ? '--' : `${Math.round(winRate * 100)}%`}
            </Badge>
            <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 ${
                    confidence === 'high'
                        ? 'border-green-600/40 text-green-400'
                        : confidence === 'medium'
                            ? 'border-yellow-600/40 text-yellow-400'
                            : 'border-slate-600 text-slate-500'
                }`}
            >
                {confidence ? confidence.toUpperCase() : '--'}
            </Badge>
        </div>
    );
}

function formatFeedTime(timestamp: number): string {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString('tr-TR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export function SymbolDetailModal({
    symbol,
    detail,
    feed,
    isLoading,
    isFeedLoading,
    onClose,
    timeRange,
}: SymbolDetailModalProps) {
    const [feedSource, setFeedSource] = useState<'all' | 'POSITIONS' | 'DERIVED'>('all');
    const filteredFeed = useMemo(
        () => (feedSource === 'all' ? feed : feed.filter((item) => item.source === feedSource)),
        [feed, feedSource],
    );

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-slate-900 border-slate-700 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl">
                        <span className="font-mono">{symbol}</span>
                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                            {timeRange}
                        </Badge>
                        {detail && (
                            <Badge
                                variant="outline"
                                className={
                                    detail.summary.consensusDirection === 'LONG'
                                        ? 'border-green-500 text-green-400'
                                        : detail.summary.consensusDirection === 'SHORT'
                                            ? 'border-red-500 text-red-400'
                                            : 'border-slate-500 text-slate-400'
                                }
                            >
                                {detail.summary.consensusDirection} ({detail.summary.confidenceScore}/100)
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="animate-pulse space-y-4 p-4">
                        <div className="h-20 bg-slate-800 rounded" />
                        <div className="h-40 bg-slate-800 rounded" />
                    </div>
                ) : detail ? (
                    <div className="space-y-6">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatBox
                                label="LONG Traders"
                                value={detail.summary.longCount}
                                color="text-green-400"
                            />
                            <StatBox
                                label="SHORT Traders"
                                value={detail.summary.shortCount}
                                color="text-red-400"
                            />
                            <StatBox
                                label="Wtd Entry (LONG)"
                                value={detail.summary.weightedAvgEntryLong > 0
                                    ? `$${formatNumber(detail.summary.weightedAvgEntryLong)}`
                                    : `$${formatNumber(detail.summary.avgEntryLong)}`}
                                color="text-green-400"
                                subtitle={detail.summary.weightedAvgEntryLong > 0
                                    ? `Simple: $${formatNumber(detail.summary.avgEntryLong)}`
                                    : undefined}
                            />
                            <StatBox
                                label="Wtd Entry (SHORT)"
                                value={detail.summary.weightedAvgEntryShort > 0
                                    ? `$${formatNumber(detail.summary.weightedAvgEntryShort)}`
                                    : `$${formatNumber(detail.summary.avgEntryShort)}`}
                                color="text-red-400"
                                subtitle={detail.summary.weightedAvgEntryShort > 0
                                    ? `Simple: $${formatNumber(detail.summary.avgEntryShort)}`
                                    : undefined}
                            />
                        </div>

                        {/* Consensus Panel */}
                        <div className="bg-slate-800/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-slate-400">Weighted Consensus</span>
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className={
                                            detail.summary.consensusDirection === 'LONG'
                                                ? 'border-green-500 text-green-400'
                                                : detail.summary.consensusDirection === 'SHORT'
                                                    ? 'border-red-500 text-red-400'
                                                    : 'border-slate-500 text-slate-400'
                                        }
                                    >
                                        {detail.summary.consensusDirection}
                                    </Badge>
                                    <span className="text-xs text-slate-500">
                                        Confidence: {detail.summary.confidenceScore}/100
                                    </span>
                                    {detail.summary.derivedConfidenceAvg !== null &&
                                        detail.summary.derivedConfidenceAvg !== undefined && (
                                            <span className="text-xs text-orange-400">
                                                Derived: {detail.summary.derivedConfidenceAvg}%
                                            </span>
                                        )}
                                </div>
                            </div>

                            {/* Weighted sentiment bar */}
                            <div className="relative">
                                <div className="flex h-5 rounded-full overflow-hidden bg-slate-700">
                                    {/* Compute visual split from sentimentScore */}
                                    {(() => {
                                        // sentimentScore: -1 (full short) to +1 (full long)
                                        // map to: longPct (0-100)
                                        const longPct = Math.round((detail.summary.sentimentScore + 1) / 2 * 100);
                                        const shortPct = 100 - longPct;
                                        return (
                                            <>
                                                <div
                                                    className="bg-gradient-to-r from-green-600 to-green-500 transition-all"
                                                    style={{ width: `${longPct}%` }}
                                                />
                                                <div
                                                    className="bg-gradient-to-r from-red-500 to-red-600 transition-all"
                                                    style={{ width: `${shortPct}%` }}
                                                />
                                            </>
                                        );
                                    })()}
                                </div>
                                {/* Center marker at 50% */}
                                <div className="absolute top-0 left-1/2 -translate-x-px w-0.5 h-5 bg-white/30" />
                            </div>

                            <div className="flex justify-between mt-2 text-xs text-slate-500">
                                <span>
                                    ${formatNumber(detail.summary.totalLongVolume)} LONG
                                </span>
                                <span className="text-slate-400 font-mono">
                                    Score: {(detail.summary.sentimentScore > 0 ? '+' : '')}{(detail.summary.sentimentScore * 100).toFixed(0)}%
                                </span>
                                <span>
                                    ${formatNumber(detail.summary.totalShortVolume)} SHORT
                                </span>
                            </div>
                        </div>

                        {/* Traders List */}
                        <div>
                            <h3 className="text-sm text-slate-400 mb-3">
                                Traders with {symbol} positions ({detail.traders.length})
                            </h3>
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {detail.traders.map((trader, index) => (
                                    <Link
                                        key={`${trader.leadId}-${index}`}
                                        href={`/traders/${trader.leadId}`}
                                        className="block"
                                    >
                                        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={trader.avatarUrl} />
                                                <AvatarFallback className="bg-slate-700">
                                                    {trader.nickname.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-white truncate">
                                                        {trader.nickname}
                                                    </span>
                                                    <WeightBadge weight={trader.traderWeight} />
                                                    {trader.segment && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[9px] px-1 py-0 ${
                                                                trader.segment === 'VISIBLE'
                                                                    ? 'border-green-600/40 text-green-500'
                                                                    : trader.segment === 'HIDDEN'
                                                                        ? 'border-orange-600/40 text-orange-400'
                                                                        : 'border-slate-600 text-slate-500'
                                                            }`}
                                                        >
                                                            {trader.segment}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="mt-1">
                                                    <ScoreBadge
                                                        qualityScore={trader.qualityScore}
                                                        winRate={trader.winRate}
                                                        confidence={trader.confidence}
                                                    />
                                                </div>
                                                {trader.isDerived && (
                                                    <div className="mt-1 flex items-center gap-1">
                                                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-600/40 text-orange-400">
                                                            DERIVED
                                                        </Badge>
                                                        <span className="text-[10px] text-orange-300">
                                                            {trader.derivedConfidence !== null && trader.derivedConfidence !== undefined
                                                                ? `Conf ${Math.round(trader.derivedConfidence * 100)}%`
                                                                : 'Conf --'}
                                                        </span>
                                                        {trader.lastAction && (
                                                            <span className="text-[10px] text-slate-500">
                                                                ({trader.lastAction})
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <span>Entry: ${formatPrice(trader.entryPrice)}</span>
                                                    <span>-&gt;</span>
                                                    <span>Mark: ${formatPrice(trader.markPrice)}</span>
                                                </div>
                                            </div>

                                            <Badge
                                                variant="outline"
                                                className={
                                                    trader.side === 'LONG'
                                                        ? 'border-green-500/50 text-green-400'
                                                        : 'border-red-500/50 text-red-400'
                                                }
                                            >
                                                {trader.side}
                                            </Badge>

                                            <div className="text-right">
                                                <div className="text-sm text-yellow-400 font-mono">
                                                    {trader.leverage !== null && trader.leverage !== undefined && trader.leverage > 0
                                                        ? trader.isDerived
                                                            ? `~${trader.leverage}x` // Show ~ for estimated leverage
                                                            : `${trader.leverage}x`
                                                        : <span className="text-slate-500">N/A</span>}
                                                </div>
                                                <div
                                                    className={`text-xs font-mono ${trader.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                                                        }`}
                                                >
                                                    {trader.pnl >= 0 ? '+' : ''}${formatNumber(trader.pnl)}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Feed Timeline */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm text-slate-400">
                                    Feed Timeline ({filteredFeed.length})
                                </h3>
                                <div className="flex items-center gap-1">
                                    {[
                                        { id: 'all', label: 'ALL' },
                                        { id: 'POSITIONS', label: 'POSITIONS' },
                                        { id: 'DERIVED', label: 'DERIVED' },
                                    ].map((opt) => (
                                        <Badge
                                            key={opt.id}
                                            variant="outline"
                                            className={`cursor-pointer text-[10px] px-2 py-0 ${
                                                feedSource === opt.id
                                                    ? 'border-blue-500 text-blue-400'
                                                    : 'border-slate-600 text-slate-500'
                                            }`}
                                            onClick={() => setFeedSource(opt.id as 'all' | 'POSITIONS' | 'DERIVED')}
                                        >
                                            {opt.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {isFeedLoading ? (
                                <div className="animate-pulse space-y-2">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-12 rounded bg-slate-800/60" />
                                    ))}
                                </div>
                            ) : filteredFeed.length === 0 ? (
                                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
                                    Bu sembol için feed kaydı bulunamadı.
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {filteredFeed.map((item, idx) => (
                                        <div
                                            key={`${item.leadId}-${item.timestamp}-${idx}`}
                                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-white truncate">{item.nickname}</span>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[9px] px-1 py-0 ${
                                                            item.source === 'POSITIONS'
                                                                ? 'border-green-600/40 text-green-400'
                                                                : 'border-orange-600/40 text-orange-400'
                                                        }`}
                                                    >
                                                        {item.source}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-600 text-slate-400">
                                                        {item.action}
                                                    </Badge>
                                                    <WeightBadge weight={item.traderWeight} />
                                                </div>
                                                <div className="mt-1 text-[11px] text-slate-400">
                                                    {item.side} · ${formatNumber(item.notional)} · {formatFeedTime(item.timestamp)}
                                                </div>
                                            </div>
                                            <div className="text-right text-[11px]">
                                                <div className="text-cyan-400">Q:{item.qualityScore ?? '--'}</div>
                                                <div className="text-indigo-300">
                                                    WR:{item.winRate === null ? '--' : `${Math.round(item.winRate * 100)}%`}
                                                </div>
                                                <div className={item.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                    {item.pnl >= 0 ? '+' : ''}${formatNumber(item.pnl)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-400 text-center py-8">
                        No data available for this symbol
                    </p>
                )}
            </DialogContent>
        </Dialog>
    );
}

function StatBox({
    label,
    value,
    color,
    subtitle,
}: {
    label: string;
    value: string | number;
    color: string;
    subtitle?: string;
}) {
    return (
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
            {subtitle && <div className="text-[10px] text-slate-600 mt-0.5">{subtitle}</div>}
        </div>
    );
}
