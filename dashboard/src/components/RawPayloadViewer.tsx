'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TraderPayload } from '@/lib/api';

interface RawPayloadViewerProps {
    payload: TraderPayload;
}

export function RawPayloadViewer({ payload }: RawPayloadViewerProps) {
    const [copied, setCopied] = useState(false);

    const prettyPayload = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(prettyPayload);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    };

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-white">Raw Payload Inspector</CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {(prettyPayload.length / 1024).toFixed(1)} KB
                        </Badge>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500 hover:text-cyan-300 transition-colors"
                        >
                            {copied ? 'Copied' : 'Copy JSON'}
                        </button>
                    </div>
                </div>
                <p className="text-xs text-slate-400">
                    Profilde gösterilmeyen tüm alanlar burada tam haliyle erişilebilir.
                </p>
            </CardHeader>
            <CardContent>
                <pre className="max-h-[640px] overflow-auto rounded-md border border-slate-800 bg-slate-950 p-4 text-xs leading-5 text-slate-200">
                    {prettyPayload}
                </pre>
            </CardContent>
        </Card>
    );
}

