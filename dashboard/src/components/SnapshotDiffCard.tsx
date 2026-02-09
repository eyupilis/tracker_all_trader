import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, TraderPayload } from '@/lib/api';
import { buildSnapshotDiff } from '@/lib/trader-insights';

interface SnapshotDiffCardProps {
    current: TraderPayload;
    previous: TraderPayload | null;
}

function deltaClass(value: number): string {
    if (value > 0) return 'text-emerald-300';
    if (value < 0) return 'text-rose-300';
    return 'text-slate-300';
}

function deltaText(value: number, fixed = 2): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(fixed)}`;
}

export function SnapshotDiffCard({ current, previous }: SnapshotDiffCardProps) {
    if (!previous) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base">Snapshot Diff</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 text-sm">Diff hesaplamak için en az iki snapshot gerekli.</p>
                </CardContent>
            </Card>
        );
    }

    const diff = buildSnapshotDiff(current, previous);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-white text-base">Snapshot Diff</CardTitle>
                    <Badge variant="outline" className="border-slate-600 text-slate-200">
                        Gap: {diff.snapshotGapMinutes === null ? '-' : `${diff.snapshotGapMinutes.toFixed(1)}m`}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Positions Δ</p>
                        <p className={`mt-1 text-sm font-semibold ${deltaClass(diff.activePositionsDelta)}`}>
                            {deltaText(diff.activePositionsDelta, 0)}
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Orders Δ</p>
                        <p className={`mt-1 text-sm font-semibold ${deltaClass(diff.orderCountDelta)}`}>
                            {deltaText(diff.orderCountDelta, 0)}
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Unrealized PnL Δ</p>
                        <p className={`mt-1 text-sm font-semibold ${deltaClass(diff.unrealizedPnlDelta)}`}>
                            ${deltaText(diff.unrealizedPnlDelta)}
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Realized PnL Δ</p>
                        <p className={`mt-1 text-sm font-semibold ${deltaClass(diff.realizedPnlDelta)}`}>
                            ${deltaText(diff.realizedPnlDelta)}
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">ROI Δ</p>
                        <p className={`mt-1 text-sm font-semibold ${deltaClass(diff.roiDelta || 0)}`}>
                            {diff.roiDelta === null ? '-' : `${deltaText(diff.roiDelta)}%`}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-slate-200 font-medium">Opened Positions</p>
                            <Badge variant="outline" className="border-emerald-500/50 text-emerald-300">
                                {diff.opened.length}
                            </Badge>
                        </div>
                        {diff.opened.length === 0 ? (
                            <p className="text-xs text-slate-500">No newly opened positions.</p>
                        ) : (
                            <div className="space-y-1">
                                {diff.opened.slice(0, 6).map((position) => (
                                    <p key={position.key} className="text-xs text-slate-300">
                                        {position.symbol} {position.side} {position.leverage.toFixed(0)}x (${formatNumber(position.notional)})
                                    </p>
                                ))}
                                {diff.opened.length > 6 && (
                                    <p className="text-xs text-slate-500">+{diff.opened.length - 6} more</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-slate-200 font-medium">Closed Positions</p>
                            <Badge variant="outline" className="border-rose-500/50 text-rose-300">
                                {diff.closed.length}
                            </Badge>
                        </div>
                        {diff.closed.length === 0 ? (
                            <p className="text-xs text-slate-500">No closed positions.</p>
                        ) : (
                            <div className="space-y-1">
                                {diff.closed.slice(0, 6).map((position) => (
                                    <p key={position.key} className="text-xs text-slate-300">
                                        {position.symbol} {position.side} {position.leverage.toFixed(0)}x (${formatNumber(position.notional)})
                                    </p>
                                ))}
                                {diff.closed.length > 6 && (
                                    <p className="text-xs text-slate-500">+{diff.closed.length - 6} more</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-slate-200 font-medium">Leverage Changes</p>
                            <Badge variant="outline" className="border-amber-500/50 text-amber-300">
                                {diff.leverageChanges.length}
                            </Badge>
                        </div>
                        {diff.leverageChanges.length === 0 ? (
                            <p className="text-xs text-slate-500">No leverage change detected.</p>
                        ) : (
                            <div className="space-y-1">
                                {diff.leverageChanges.slice(0, 6).map((change) => (
                                    <p key={change.key} className="text-xs text-slate-300">
                                        {change.symbol} {change.side} {change.leverageBefore.toFixed(0)}x → {change.leverageAfter.toFixed(0)}x
                                    </p>
                                ))}
                                {diff.leverageChanges.length > 6 && (
                                    <p className="text-xs text-slate-500">+{diff.leverageChanges.length - 6} more</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
