'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProfileSnapshotCardProps {
    fetchedAt: string;
    timeRange: string;
    startTime: number;
    endTime: number;
    positionsCount: number;
    ordersLoaded: number;
    ordersTotal: number;
    roiPoints: number;
    assetRows: number;
}

function formatTs(ts: number): string {
    return new Date(ts).toLocaleString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function ProfileSnapshotCard({
    fetchedAt,
    timeRange,
    startTime,
    endTime,
    positionsCount,
    ordersLoaded,
    ordersTotal,
    roiPoints,
    assetRows,
}: ProfileSnapshotCardProps) {
    const rangeHours = Math.max(0, (endTime - startTime) / (1000 * 60 * 60));
    const fetchedAtDate = new Date(fetchedAt);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-white">Snapshot Metadata</CardTitle>
                    <Badge variant="outline" className="border-cyan-500/50 text-cyan-300">
                        {timeRange}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetaBox label="Fetched At" value={fetchedAtDate.toLocaleString('tr-TR')} />
                    <MetaBox label="Window Start" value={formatTs(startTime)} />
                    <MetaBox label="Window End" value={formatTs(endTime)} />
                    <MetaBox label="Window Size" value={`${rangeHours.toFixed(1)}h`} />
                    <MetaBox label="Active Positions" value={positionsCount.toString()} />
                    <MetaBox label="Orders Loaded" value={ordersLoaded.toString()} />
                    <MetaBox label="Orders Total" value={ordersTotal.toString()} />
                    <MetaBox label="ROI / Assets" value={`${roiPoints} / ${assetRows}`} />
                </div>
            </CardContent>
        </Card>
    );
}

function MetaBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100 break-words">{value}</p>
        </div>
    );
}

