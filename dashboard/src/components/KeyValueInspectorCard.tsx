'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface KeyValueInspectorCardProps {
    title: string;
    data: Record<string, unknown> | null | undefined;
    description?: string;
    enableDetailDrawer?: boolean;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';

    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const allPrimitive = value.every((item) => {
            const t = typeof item;
            return item === null || t === 'string' || t === 'number' || t === 'boolean';
        });
        if (allPrimitive && value.length <= 6) {
            return `[${value.map((v) => String(v)).join(', ')}]`;
        }
        return `${value.length} items`;
    }

    try {
        const raw = JSON.stringify(value);
        if (!raw) return '{}';
        return raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
    } catch {
        return '[unserializable]';
    }
}

export function KeyValueInspectorCard({
    title,
    data,
    description,
    enableDetailDrawer = true,
}: KeyValueInspectorCardProps) {
    const [query, setQuery] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<{ key: string; value: unknown } | null>(null);

    const entries = useMemo(() => {
        if (!data) return [];
        return Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
    }, [data]);

    const filtered = useMemo(() => {
        if (!query.trim()) return entries;
        const q = query.toLowerCase();
        return entries.filter(([key, value]) => {
            const v = formatValue(value).toLowerCase();
            return key.toLowerCase().includes(q) || v.includes(q);
        });
    }, [entries, query]);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-white text-base">{title}</CardTitle>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {filtered.length}/{entries.length}
                    </Badge>
                </div>
                {description && <p className="text-xs text-slate-400">{description}</p>}
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Field ara..."
                    className="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                />
            </CardHeader>
            <CardContent>
                {filtered.length === 0 ? (
                    <p className="text-sm text-slate-500">Eşleşen alan bulunamadı.</p>
                ) : (
                    <div className="max-h-[420px] overflow-auto rounded-md border border-slate-800">
                        <div className="divide-y divide-slate-800">
                            {filtered.map(([key, value]) => {
                                const valueType = Array.isArray(value) ? 'array' : typeof value;
                                const rendered = formatValue(value);
                                const isExpandable =
                                    value !== null &&
                                    (Array.isArray(value) ||
                                        typeof value === 'object' ||
                                        (typeof value === 'string' && value.length > 80));

                                return (
                                    <div key={key} className="grid grid-cols-12 gap-3 px-3 py-2 text-sm">
                                        <div className="col-span-5 md:col-span-4">
                                            <p className="font-mono text-cyan-300 break-words">{key}</p>
                                            <p className="text-[10px] uppercase tracking-wide text-slate-500">{valueType}</p>
                                        </div>
                                        <div className="col-span-7 md:col-span-8 flex items-start">
                                            {typeof value === 'boolean' ? (
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        value
                                                            ? 'border-green-500/50 text-green-300'
                                                            : 'border-slate-600 text-slate-300'
                                                    }
                                                >
                                                    {rendered}
                                                </Badge>
                                            ) : (
                                                <div className="w-full flex items-start justify-between gap-2">
                                                    <p className="text-slate-200 break-all">{rendered}</p>
                                                    {isExpandable && enableDetailDrawer && (
                                                        <button
                                                            type="button"
                                                            className="shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-cyan-500 hover:text-cyan-300"
                                                            onClick={() => setSelectedEntry({ key, value })}
                                                        >
                                                            View
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <Dialog
                    open={enableDetailDrawer && Boolean(selectedEntry)}
                    onOpenChange={(open) => !open && setSelectedEntry(null)}
                >
                    <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-slate-100">
                        <DialogHeader>
                            <DialogTitle>Field Detail</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                {selectedEntry?.key || '-'}
                            </DialogDescription>
                        </DialogHeader>
                        {selectedEntry && (
                            <pre className="max-h-[60vh] overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
                                {typeof selectedEntry.value === 'string'
                                    ? selectedEntry.value
                                    : JSON.stringify(selectedEntry.value, null, 2)}
                            </pre>
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
