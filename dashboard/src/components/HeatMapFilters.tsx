'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export interface HeatMapFiltersState {
    timeRange: string;
    side: string;
    segment: 'VISIBLE' | 'HIDDEN' | 'BOTH';
    leverage: string;
    minTraders: string;
    sortBy: string;
    minConfidence: string;
    minSentimentAbs: string;
}

interface HeatMapFiltersProps {
    filters: HeatMapFiltersState;
    onFilterChange: (filters: HeatMapFiltersState) => void;
    isLoading?: boolean;
    lastUpdate?: Date;
}

export function HeatMapFilters({ filters, onFilterChange, isLoading, lastUpdate }: HeatMapFiltersProps) {
    const updateFilter = (key: keyof HeatMapFiltersState, value: string) => {
        onFilterChange({ ...filters, [key]: value });
    };

    return (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800">
            {/* Time Range */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Time:</span>
                <Select value={filters.timeRange} onValueChange={(v) => updateFilter('timeRange', v)}>
                    <SelectTrigger className="w-24 h-8 bg-slate-800 border-slate-700 text-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="1h">1 Hour</SelectItem>
                        <SelectItem value="4h">4 Hours</SelectItem>
                        <SelectItem value="24h">24 Hours</SelectItem>
                        <SelectItem value="7d">7 Days</SelectItem>
                        <SelectItem value="ALL">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Side Filter */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Side:</span>
                <div className="flex gap-1">
                    {['ALL', 'LONG', 'SHORT'].map((side) => (
                        <Badge
                            key={side}
                            variant="outline"
                            className={`cursor-pointer transition-colors ${filters.side === side
                                    ? side === 'LONG'
                                        ? 'bg-green-500/20 border-green-500 text-green-400'
                                        : side === 'SHORT'
                                            ? 'bg-red-500/20 border-red-500 text-red-400'
                                            : 'bg-blue-500/20 border-blue-500 text-blue-400'
                                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                                }`}
                            onClick={() => updateFilter('side', side)}
                        >
                            {side}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Segment Scope */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Scope:</span>
                <Select value={filters.segment} onValueChange={(v) => updateFilter('segment', v as HeatMapFiltersState['segment'])}>
                    <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-700 text-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="VISIBLE">Visible</SelectItem>
                        <SelectItem value="HIDDEN">Hidden</SelectItem>
                        <SelectItem value="BOTH">Both</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Leverage Filter */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Leverage:</span>
                <Select value={filters.leverage} onValueChange={(v) => updateFilter('leverage', v)}>
                    <SelectTrigger className="w-28 h-8 bg-slate-800 border-slate-700 text-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="<20x">&lt;20x</SelectItem>
                        <SelectItem value="20-50x">20-50x</SelectItem>
                        <SelectItem value="50-100x">50-100x</SelectItem>
                        <SelectItem value=">100x">&gt;100x</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Min Traders */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Min:</span>
                <Select value={filters.minTraders} onValueChange={(v) => updateFilter('minTraders', v)}>
                    <SelectTrigger className="w-20 h-8 bg-slate-800 border-slate-700 text-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Min Confidence */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Conf:</span>
                <Select value={filters.minConfidence} onValueChange={(v) => updateFilter('minConfidence', v)}>
                    <SelectTrigger className="w-20 h-8 bg-slate-800 border-slate-700 text-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="0">All</SelectItem>
                        <SelectItem value="20">20+</SelectItem>
                        <SelectItem value="40">40+</SelectItem>
                        <SelectItem value="60">60+</SelectItem>
                        <SelectItem value="80">80+</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Min Sentiment Strength */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Sent:</span>
                <Select value={filters.minSentimentAbs} onValueChange={(v) => updateFilter('minSentimentAbs', v)}>
                    <SelectTrigger className="w-20 h-8 bg-slate-800 border-slate-700 text-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="0">All</SelectItem>
                        <SelectItem value="20">20%+</SelectItem>
                        <SelectItem value="40">40%+</SelectItem>
                        <SelectItem value="60">60%+</SelectItem>
                        <SelectItem value="80">80%+</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Sort:</span>
                <Select value={filters.sortBy} onValueChange={(v) => updateFilter('sortBy', v)}>
                    <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-700 text-white text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="confidence">Confidence</SelectItem>
                        <SelectItem value="traders">Traders</SelectItem>
                        <SelectItem value="volume">Volume</SelectItem>
                        <SelectItem value="sentiment">Sentiment</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Status */}
            <div className="flex items-center gap-2">
                {isLoading && (
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-xs text-slate-400">Loading...</span>
                    </div>
                )}
                {lastUpdate && !isLoading && (
                    <span className="text-xs text-slate-500">
                        Updated: {lastUpdate.toLocaleTimeString('tr-TR')}
                    </span>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-400 hover:text-white"
                    onClick={() => onFilterChange(filters)} // Trigger refresh
                >
                    Refresh
                </Button>
            </div>
        </div>
    );
}
