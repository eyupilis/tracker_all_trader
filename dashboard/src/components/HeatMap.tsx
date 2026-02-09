'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber, HeatMapData } from '@/lib/api';

interface HeatMapProps {
    data: HeatMapData[];
    onSymbolClick?: (symbol: string) => void;
    isLoading?: boolean;
}

function ConfidenceBar({ score }: { score: number }) {
    // Color: green(high) -> yellow(medium) -> red(low)
    const color =
        score >= 70 ? 'bg-green-500' :
        score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
    return (
        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
                className={`h-full ${color} transition-all`}
                style={{ width: `${score}%` }}
            />
        </div>
    );
}

function SentimentIndicator({ score, direction }: { score: number; direction: string }) {
    const pct = Math.round(Math.abs(score) * 100);
    if (direction === 'LONG') {
        return (
            <div className="flex items-center gap-1">
                <span className="text-green-400 font-bold text-xs">{pct}%</span>
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
            </div>
        );
    }
    if (direction === 'SHORT') {
        return (
            <div className="flex items-center gap-1">
                <span className="text-red-400 font-bold text-xs">{pct}%</span>
                <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
            </div>
        );
    }
    return <span className="text-slate-500 text-xs">--</span>;
}

export function HeatMap({ data, onSymbolClick, isLoading }: HeatMapProps) {
    if (isLoading) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">Position Heat Map</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-12 bg-slate-800 rounded" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.length === 0) {
        return (
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">Position Heat Map</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 text-center py-8">
                        No position data available. Add more traders to see aggregated signals.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Find max for scaling
    const maxTraders = Math.max(...data.map(d => Math.max(d.longCount, d.shortCount)));

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Consensus Heat Map</CardTitle>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded" />
                            <span className="text-slate-400">LONG</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded" />
                            <span className="text-slate-400">SHORT</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 pb-2 border-b border-slate-800">
                    <div className="col-span-2">Symbol</div>
                    <div className="col-span-4 text-center">LONG / SHORT</div>
                    <div className="col-span-1 text-center">Lev</div>
                    <div className="col-span-2 text-center">Consensus</div>
                    <div className="col-span-1 text-center">Conf.</div>
                    <div className="col-span-2 text-right">Volume</div>
                </div>

                {/* Data Rows */}
                {data.map((item) => (
                    <div
                        key={item.symbol}
                        className="grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => onSymbolClick?.(item.symbol)}
                    >
                        {/* Symbol */}
                        <div className="col-span-2">
                            <div className="font-mono text-white font-semibold text-sm">
                                {item.symbol.replace('USDT', '')}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                <div className="text-[10px] text-slate-500">
                                    {item.totalTraders} trader{item.totalTraders > 1 ? 's' : ''}
                                </div>
                                {item.dataSource && (
                                    <Badge
                                        variant="outline"
                                        className={`text-[8px] px-1 py-0 ${
                                            item.dataSource === 'HIDDEN_DERIVED'
                                                ? 'border-orange-600/40 text-orange-400'
                                                : item.dataSource === 'MIXED'
                                                    ? 'border-blue-600/40 text-blue-400'
                                                    : 'border-green-600/40 text-green-400'
                                        }`}
                                    >
                                        {item.dataSource}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Bar Chart */}
                        <div className="col-span-4 flex items-center gap-1">
                            {/* LONG bar */}
                            <div className="flex-1 flex justify-end">
                                <div
                                    className="h-6 bg-gradient-to-l from-green-500 to-green-600 rounded-l flex items-center justify-end px-2"
                                    style={{
                                        width: `${maxTraders > 0 ? (item.longCount / maxTraders) * 100 : 0}%`,
                                        minWidth: item.longCount > 0 ? '30px' : '0'
                                    }}
                                >
                                    {item.longCount > 0 && (
                                        <span className="text-xs font-bold text-white">{item.longCount}</span>
                                    )}
                                </div>
                            </div>

                            {/* Center divider */}
                            <div className="w-px h-8 bg-slate-600" />

                            {/* SHORT bar */}
                            <div className="flex-1 flex justify-start">
                                <div
                                    className="h-6 bg-gradient-to-r from-red-500 to-red-600 rounded-r flex items-center px-2"
                                    style={{
                                        width: `${maxTraders > 0 ? (item.shortCount / maxTraders) * 100 : 0}%`,
                                        minWidth: item.shortCount > 0 ? '30px' : '0'
                                    }}
                                >
                                    {item.shortCount > 0 && (
                                        <span className="text-xs font-bold text-white">{item.shortCount}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Weighted Average Leverage */}
                        <div className="col-span-1 text-center">
                            <span className="text-yellow-400 font-mono text-sm">{item.weightedAvgLeverage}x</span>
                        </div>

                        {/* Consensus Direction + Sentiment Score */}
                        <div className="col-span-2 flex flex-col items-center gap-0.5">
                            <SentimentIndicator score={item.sentimentScore} direction={item.consensusDirection} />
                            <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${
                                    item.consensusDirection === 'LONG'
                                        ? 'border-green-500/50 text-green-400'
                                        : item.consensusDirection === 'SHORT'
                                            ? 'border-red-500/50 text-red-400'
                                            : 'border-slate-500/50 text-slate-400'
                                }`}
                            >
                                {item.consensusDirection}
                            </Badge>
                            {item.derivedConfidenceAvg !== null && item.derivedConfidenceAvg !== undefined && (
                                <span className="text-[9px] text-orange-400">
                                    D:{item.derivedConfidenceAvg}%
                                </span>
                            )}
                        </div>

                        {/* Confidence Score */}
                        <div className="col-span-1 flex flex-col items-center gap-0.5">
                            <span className={`text-xs font-mono font-bold ${
                                item.confidenceScore >= 70 ? 'text-green-400' :
                                item.confidenceScore >= 40 ? 'text-yellow-400' : 'text-slate-500'
                            }`}>
                                {item.confidenceScore}
                            </span>
                            <ConfidenceBar score={item.confidenceScore} />
                        </div>

                        {/* Volume */}
                        <div className="col-span-2 text-right text-slate-300 font-mono text-sm">
                            ${formatNumber(Math.abs(item.totalVolume))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
