'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { HeatMap } from '@/components/HeatMap';
import { HeatMapFilters, HeatMapFiltersState } from '@/components/HeatMapFilters';
import { InsightsPanel } from '@/components/InsightsPanel';
import { SimulationPanel } from '@/components/SimulationPanel';
import { SymbolDetailModal } from '@/components/SymbolDetailModal';
import {
    getHeatMapData,
    getInsightsRule,
    getSignalsInsights,
    getSignalsFeed,
    getSymbolDetail,
    HeatMapData,
    InsightsMode,
    InsightsRule,
    InsightsRuleUpdatePayload,
    SignalsInsights,
    SignalsFeedItem,
    SymbolDetail,
    updateInsightsRule,
} from '@/lib/api';

export default function SignalsPage() {
    const [viewTab, setViewTab] = useState<'VISIBLE' | 'HIDDEN'>('VISIBLE');
    const [rawData, setRawData] = useState<HeatMapData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [symbolDetail, setSymbolDetail] = useState<SymbolDetail | null>(null);
    const [symbolFeed, setSymbolFeed] = useState<SignalsFeedItem[]>([]);
    const [isModalLoading, setIsModalLoading] = useState(false);
    const [isFeedLoading, setIsFeedLoading] = useState(false);
    const [insights, setInsights] = useState<SignalsInsights | null>(null);
    const [isInsightsLoading, setIsInsightsLoading] = useState(false);
    const [insightsMode, setInsightsMode] = useState<InsightsMode>('balanced');
    const [insightsRule, setInsightsRule] = useState<InsightsRule | null>(null);
    const [isInsightsRuleLoading, setIsInsightsRuleLoading] = useState(false);
    const [isInsightsRuleSaving, setIsInsightsRuleSaving] = useState(false);

    const [filters, setFilters] = useState<HeatMapFiltersState>({
        timeRange: '24h',
        side: 'ALL',
        segment: 'VISIBLE',
        leverage: 'ALL',
        minTraders: '1',
        sortBy: 'confidence',
        minConfidence: '0',
        minSentimentAbs: '0',
    });

    const fetchHeatMapData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await getHeatMapData(filters);
            if (response.success) {
                setRawData(response.data);
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Failed to fetch heatmap data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchHeatMapData();
    }, [fetchHeatMapData]);

    const fetchInsights = useCallback(async () => {
        setIsInsightsLoading(true);
        try {
            const response = await getSignalsInsights({
                timeRange: filters.timeRange as '1h' | '4h' | '24h' | '7d' | 'ALL',
                segment: (filters.segment || viewTab) as 'VISIBLE' | 'HIDDEN' | 'BOTH',
                top: 10,
                mode: insightsMode,
            });
            if (response.success) {
                setInsights(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch insights:', error);
        } finally {
            setIsInsightsLoading(false);
        }
    }, [filters.timeRange, filters.segment, viewTab, insightsMode]);

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    const fetchInsightsRule = useCallback(async () => {
        setIsInsightsRuleLoading(true);
        try {
            const response = await getInsightsRule();
            if (response.success) {
                setInsightsRule(response.data);
                setInsightsMode(response.data.defaultMode);
            }
        } catch (error) {
            console.error('Failed to fetch insights rule:', error);
        } finally {
            setIsInsightsRuleLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInsightsRule();
    }, [fetchInsightsRule]);

    const handleSaveInsightsRule = useCallback(async (payload: InsightsRuleUpdatePayload) => {
        setIsInsightsRuleSaving(true);
        try {
            const response = await updateInsightsRule(payload);
            if (response.success) {
                setInsightsRule(response.data);
                setInsightsMode(response.data.defaultMode);
            }
        } catch (error) {
            console.error('Failed to save insights rule:', error);
        } finally {
            setIsInsightsRuleSaving(false);
        }
    }, []);

    useEffect(() => {
        setFilters((prev) => ({ ...prev, segment: viewTab }));
    }, [viewTab]);

    // Client-side: filter by confidence + sort
    const heatMapData = useMemo(() => {
        const minConf = parseInt(filters.minConfidence) || 0;
        const minSent = parseInt(filters.minSentimentAbs) || 0;
        let filtered = rawData;
        if (minConf > 0) {
            filtered = rawData.filter(d => d.confidenceScore >= minConf);
        }
        if (minSent > 0) {
            filtered = filtered.filter(d => Math.abs(d.sentimentScore) * 100 >= minSent);
        }

        const sorted = [...filtered];
        switch (filters.sortBy) {
            case 'confidence':
                sorted.sort((a, b) => b.confidenceScore - a.confidenceScore || b.totalTraders - a.totalTraders);
                break;
            case 'traders':
                sorted.sort((a, b) => b.totalTraders - a.totalTraders);
                break;
            case 'volume':
                sorted.sort((a, b) => b.totalVolume - a.totalVolume);
                break;
            case 'sentiment':
                sorted.sort((a, b) => Math.abs(b.sentimentScore) - Math.abs(a.sentimentScore));
                break;
        }
        return sorted;
    }, [rawData, filters.minConfidence, filters.minSentimentAbs, filters.sortBy]);

    const handleSymbolClick = async (symbol: string) => {
        setSelectedSymbol(symbol);
        setIsModalLoading(true);
        setIsFeedLoading(true);
        setSymbolDetail(null);
        setSymbolFeed([]);
        try {
            // Always show ALL traders (BOTH) in modal, regardless of current tab
            const symbolSegment = 'BOTH';
            const feedSource = 'all';
            const [detailRes, feedRes] = await Promise.all([
                getSymbolDetail(symbol, filters.timeRange, symbolSegment),
                getSignalsFeed({
                    symbol,
                    source: feedSource,
                    limit: 80,
                    timeRange: filters.timeRange,
                    segment: symbolSegment,
                }),
            ]);
            if (detailRes.success) {
                setSymbolDetail(detailRes.data);
            }
            if (feedRes.success) {
                setSymbolFeed(feedRes.data);
            }
        } catch (error) {
            console.error('Failed to fetch symbol detail/feed:', error);
        } finally {
            setIsModalLoading(false);
            setIsFeedLoading(false);
        }
    };

    const handleCloseModal = () => {
        setSelectedSymbol(null);
        setSymbolDetail(null);
        setSymbolFeed([]);
    };

    // Consensus-aware stats
    const stats = useMemo(() => {
        if (heatMapData.length === 0) return null;
        const highConfidence = heatMapData.filter(d => d.confidenceScore >= 60);
        const avgDerivedConfidence = heatMapData
            .filter((d) => d.derivedConfidenceAvg !== null && d.derivedConfidenceAvg !== undefined)
            .reduce((sum, d, _idx, arr) => sum + (d.derivedConfidenceAvg || 0) / arr.length, 0);
        const avgConfidence = heatMapData.length > 0
            ? Math.round(heatMapData.reduce((s, d) => s + d.confidenceScore, 0) / heatMapData.length)
            : 0;
        const consensusLong = heatMapData.filter(d => d.consensusDirection === 'LONG').length;
        const consensusShort = heatMapData.filter(d => d.consensusDirection === 'SHORT').length;
        return {
            highConfidence: highConfidence.length,
            avgConfidence,
            consensusLong,
            consensusShort,
            avgDerivedConfidence: Math.round(avgDerivedConfidence),
        };
    }, [heatMapData]);

    return (
        <main className="min-h-screen bg-slate-950 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
                            &larr; Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-white">Consensus Signal Panel</h1>
                        <p className="text-slate-400 mt-1">
                            Weighted consensus analysis across all tracked traders
                        </p>
                    </div>
                    <div className="text-right space-y-3">
                        <Link
                            href="/signals/consensus"
                            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            🎯 Consensus Signals
                        </Link>
                        <div>
                            <div className="text-2xl font-bold text-white">{heatMapData.length}</div>
                            <div className="text-xs text-slate-400">Active Symbols</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setViewTab('VISIBLE')}
                        className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                            viewTab === 'VISIBLE'
                                ? 'border-green-500 text-green-400 bg-green-500/10'
                                : 'border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                    >
                        Visible Traders
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewTab('HIDDEN')}
                        className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                            viewTab === 'HIDDEN'
                                ? 'border-orange-500 text-orange-400 bg-orange-500/10'
                                : 'border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                    >
                        Hidden Traders (Derived)
                    </button>
                </div>

                <HeatMapFilters
                    filters={filters}
                    onFilterChange={setFilters}
                    isLoading={isLoading}
                    lastUpdate={lastUpdate || undefined}
                />

                {/* Consensus Summary Stats */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            label={viewTab === 'HIDDEN' ? 'Derived LONG' : 'Consensus LONG'}
                            value={stats.consensusLong}
                            color="text-green-400"
                        />
                        <StatCard
                            label={viewTab === 'HIDDEN' ? 'Derived SHORT' : 'Consensus SHORT'}
                            value={stats.consensusShort}
                            color="text-red-400"
                        />
                        <StatCard
                            label={viewTab === 'HIDDEN' ? 'Derived Conf. Avg' : 'High Confidence (60+)'}
                            value={viewTab === 'HIDDEN' ? stats.avgDerivedConfidence : stats.highConfidence}
                            color="text-yellow-400"
                        />
                        <StatCard
                            label={viewTab === 'HIDDEN' ? 'Consensus Confidence' : 'Avg Confidence'}
                            value={stats.avgConfidence}
                            color="text-blue-400"
                        />
                    </div>
                )}

                <InsightsPanel
                    data={insights}
                    isLoading={isInsightsLoading}
                    viewScope={viewTab}
                    mode={insightsMode}
                    onModeChange={setInsightsMode}
                    rule={insightsRule}
                    isRuleLoading={isInsightsRuleLoading}
                    isRuleSaving={isInsightsRuleSaving}
                    onReloadRule={fetchInsightsRule}
                    onSaveRule={handleSaveInsightsRule}
                />

                <SimulationPanel
                    symbols={heatMapData.map((h) => h.symbol)}
                    preferredSymbol={selectedSymbol}
                    viewScope={viewTab}
                />

                {/* Heat Map */}
                <HeatMap
                    data={heatMapData}
                    onSymbolClick={handleSymbolClick}
                    isLoading={isLoading}
                />

                {/* Symbol Detail Modal */}
                {selectedSymbol && (
                    <SymbolDetailModal
                        symbol={selectedSymbol}
                        detail={symbolDetail}
                        feed={symbolFeed}
                        isLoading={isModalLoading}
                        isFeedLoading={isFeedLoading}
                        onClose={handleCloseModal}
                        timeRange={filters.timeRange}
                    />
                )}
            </div>
        </main>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
        </div>
    );
}
