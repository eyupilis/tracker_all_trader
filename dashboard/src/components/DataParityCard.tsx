'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TraderPayload } from '@/lib/api';

interface DataParityCardProps {
    payload: TraderPayload;
    backendStoredPositionsCount: number | null;
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function ParityRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100 break-words">{value}</p>
        </div>
    );
}

export function DataParityCard({ payload, backendStoredPositionsCount }: DataParityCardProps) {
    const sourceRawPositionsCount = toNumber(payload.positionAudit?.sourceRawPositionsCount);
    const sourceNonZeroPositionsCount = toNumber(payload.positionAudit?.filteredActivePositionsCount);
    const n8nActivePositionsCount = Array.isArray(payload.activePositions) ? payload.activePositions.length : 0;
    const uiRenderedPositionsCount = n8nActivePositionsCount;
    const backendCount = backendStoredPositionsCount;

    const mismatches: string[] = [];
    if (sourceNonZeroPositionsCount !== null && sourceNonZeroPositionsCount !== n8nActivePositionsCount) {
        mismatches.push('n8n filtered count != payload.activePositions.length');
    }
    if (backendCount !== null && backendCount !== n8nActivePositionsCount) {
        mismatches.push('backend stored positionsCount != payload.activePositions.length');
    }

    const status =
        mismatches.length === 0
            ? {
                label: sourceNonZeroPositionsCount === null ? 'MATCH (no source audit)' : 'MATCH',
                className: 'border-emerald-500/50 text-emerald-300',
            }
            : {
                label: 'MISMATCH',
                className: 'border-rose-500/50 text-rose-300',
            };

    const dropped = toNumber(payload.positionAudit?.droppedPositionsCount);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-white">Data Parity (Positions)</CardTitle>
                    <Badge variant="outline" className={status.className}>
                        {status.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <ParityRow
                        label="Source Raw"
                        value={sourceRawPositionsCount === null ? '-' : sourceRawPositionsCount.toString()}
                    />
                    <ParityRow
                        label="Source Non-Zero"
                        value={sourceNonZeroPositionsCount === null ? '-' : sourceNonZeroPositionsCount.toString()}
                    />
                    <ParityRow label="n8n Active" value={n8nActivePositionsCount.toString()} />
                    <ParityRow
                        label="Backend Stored"
                        value={backendCount === null ? '-' : backendCount.toString()}
                    />
                    <ParityRow label="UI Rendered" value={uiRenderedPositionsCount.toString()} />
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                    <span>Dropped by filter:</span>
                    <span className="text-slate-200 font-semibold">{dropped === null ? '-' : dropped.toString()}</span>
                </div>

                {mismatches.length > 0 && (
                    <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200 space-y-1">
                        {mismatches.map((item) => (
                            <p key={item}>- {item}</p>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
