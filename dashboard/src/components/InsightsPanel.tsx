'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    formatNumber,
    InsightsMode,
    InsightsPresetConfig,
    InsightsRule,
    InsightsRuleUpdatePayload,
    SignalsInsights,
} from '@/lib/api';

interface InsightsPanelProps {
    data: SignalsInsights | null;
    isLoading: boolean;
    viewScope: 'VISIBLE' | 'HIDDEN';
    mode: InsightsMode;
    onModeChange: (mode: InsightsMode) => void;
    rule: InsightsRule | null;
    isRuleLoading: boolean;
    isRuleSaving: boolean;
    onReloadRule: () => void;
    onSaveRule: (payload: InsightsRuleUpdatePayload) => Promise<void> | void;
}

function levelClass(level: 'LOW' | 'MEDIUM' | 'HIGH'): string {
    if (level === 'HIGH') return 'text-red-400 border-red-500/40';
    if (level === 'MEDIUM') return 'text-yellow-400 border-yellow-500/40';
    return 'text-emerald-400 border-emerald-500/40';
}

function severityClass(level: 'LOW' | 'MEDIUM' | 'HIGH'): string {
    if (level === 'HIGH') return 'text-red-400';
    if (level === 'MEDIUM') return 'text-yellow-300';
    return 'text-slate-400';
}

function toPositiveNumber(value: string, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

export function InsightsPanel({
    data,
    isLoading,
    viewScope,
    mode,
    onModeChange,
    rule,
    isRuleLoading,
    isRuleSaving,
    onReloadRule,
    onSaveRule,
}: InsightsPanelProps) {
    const [defaultModeDraft, setDefaultModeDraft] = useState<InsightsMode>('balanced');
    const [presetDraft, setPresetDraft] = useState<InsightsPresetConfig | null>(null);

    useEffect(() => {
        if (!rule) return;
        setDefaultModeDraft(rule.defaultMode);
        setPresetDraft(rule.presets[mode]);
    }, [rule, mode]);

    const handlePresetField = (field: keyof InsightsPresetConfig, value: string) => {
        setPresetDraft((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                [field]: toPositiveNumber(value, prev[field]),
            };
        });
    };

    const handleSaveRule = async () => {
        if (!presetDraft) return;
        const presetsPatch: InsightsRuleUpdatePayload['presets'] = {
            [mode]: presetDraft,
        };
        await onSaveRule({
            defaultMode: defaultModeDraft,
            presets: presetsPatch,
        });
    };

    if (isLoading) {
        return (
            <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                <div className="animate-pulse space-y-2">
                    <div className="h-6 w-56 rounded bg-slate-800" />
                    <div className="h-20 rounded bg-slate-800" />
                    <div className="h-28 rounded bg-slate-800" />
                </div>
            </section>
        );
    }

    if (!data) return null;

    const unstableRows = data.stability.slice(0, 8);
    const anomalyRows = data.anomalies.slice(0, 8);
    const leaderboardRows = data.leaderboard.slice(0, 10);

    return (
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-white font-semibold">Risk & Stability Insights (Faz 6)</h2>
                    <p className="text-xs text-slate-400">
                        Segment {viewScope} · {data.filters.timeRange} window · updated {new Date(data.generatedAt).toLocaleTimeString('tr-TR')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded border border-slate-700 p-0.5">
                        {(['conservative', 'balanced', 'aggressive'] as InsightsMode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => onModeChange(m)}
                                className={`text-[11px] px-2 py-1 rounded transition-colors ${
                                    mode === m
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded border ${levelClass(data.riskOverview.level)}`}>
                        Risk {data.riskOverview.level} ({Math.round(data.riskOverview.score)})
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                <Kpi label="Crowded" value={data.riskOverview.crowdedSymbols} color="text-red-400" />
                <Kpi label="High Lev" value={data.riskOverview.highLeverageSymbols} color="text-yellow-300" />
                <Kpi label="Unstable" value={data.riskOverview.unstableSymbols} color="text-orange-300" />
                <Kpi label="Low Conf" value={data.riskOverview.lowConfidenceSymbols} color="text-slate-300" />
                <Kpi label="Anomalies" value={data.anomalies.length} color="text-cyan-300" />
                <Kpi label="Leaderboard" value={data.leaderboard.length} color="text-emerald-300" />
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-400">
                        Persistent Rule Config ({mode}) {isRuleLoading ? 'loading...' : ''}
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={defaultModeDraft}
                            onChange={(e) => setDefaultModeDraft(e.target.value as InsightsMode)}
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                        >
                            <option value="conservative">conservative</option>
                            <option value="balanced">balanced</option>
                            <option value="aggressive">aggressive</option>
                        </select>
                        <button
                            type="button"
                            onClick={onReloadRule}
                            disabled={isRuleLoading || isRuleSaving}
                            className="text-[11px] px-2 py-1 rounded border border-slate-600 text-slate-300 disabled:opacity-50"
                        >
                            Reload
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveRule}
                            disabled={!presetDraft || isRuleLoading || isRuleSaving}
                            className="text-[11px] px-2 py-1 rounded border border-blue-600/50 text-blue-300 disabled:opacity-50"
                        >
                            Save Rule
                        </button>
                    </div>
                </div>

                {presetDraft && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <PresetInput label="Crowded Min Traders" value={presetDraft.crowdedMinTraders} onChange={(v) => handlePresetField('crowdedMinTraders', v)} />
                        <PresetInput label="Crowded Min Confidence" value={presetDraft.crowdedMinConfidence} onChange={(v) => handlePresetField('crowdedMinConfidence', v)} />
                        <PresetInput label="Crowded Min Sentiment" value={presetDraft.crowdedMinSentimentAbs} onChange={(v) => handlePresetField('crowdedMinSentimentAbs', v)} />
                        <PresetInput label="Low Confidence Limit" value={presetDraft.lowConfidenceLimit} onChange={(v) => handlePresetField('lowConfidenceLimit', v)} />
                        <PresetInput label="High Leverage Threshold" value={presetDraft.highLeverageThreshold} onChange={(v) => handlePresetField('highLeverageThreshold', v)} />
                        <PresetInput label="Extreme Leverage Threshold" value={presetDraft.extremeLeverageThreshold} onChange={(v) => handlePresetField('extremeLeverageThreshold', v)} />
                        <PresetInput label="Unstable Min Flips" value={presetDraft.unstableMinFlips} onChange={(v) => handlePresetField('unstableMinFlips', v)} />
                        <PresetInput label="Unstable High Flips" value={presetDraft.unstableHighFlips} onChange={(v) => handlePresetField('unstableHighFlips', v)} />
                        <PresetInput label="Unstable Min Updates" value={presetDraft.unstableMinUpdates} onChange={(v) => handlePresetField('unstableMinUpdates', v)} />
                        <PresetInput label="Score Multiplier" value={presetDraft.scoreMultiplier} onChange={(v) => handlePresetField('scoreMultiplier', v)} />
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-xs text-slate-400 mb-2">Anomalies</div>
                    {anomalyRows.length === 0 ? (
                        <div className="text-xs text-slate-500">No anomalies in selected window.</div>
                    ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto">
                            {anomalyRows.map((row, idx) => (
                                <div key={`${row.type}-${row.symbol}-${idx}`} className="rounded border border-slate-800 px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs text-slate-200">
                                            <span className="font-mono">{row.symbol}</span>{' '}
                                            <span className={severityClass(row.severity)}>{row.severity}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            {row.metric}: {typeof row.value === 'number' ? formatNumber(row.value) : row.value}
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">{row.message}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-xs text-slate-400 mb-2">Least Stable Symbols</div>
                    {unstableRows.length === 0 ? (
                        <div className="text-xs text-slate-500">Insufficient event stream for stability scoring.</div>
                    ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto">
                            {unstableRows.map((row) => (
                                <div key={row.symbol} className="flex items-center justify-between rounded border border-slate-800 px-2 py-1.5">
                                    <div className="text-xs text-slate-200">
                                        <span className="font-mono">{row.symbol}</span>{' '}
                                        <span className="text-slate-500">({row.lastDirection})</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        score {row.stabilityScore} · flips {row.flips}/{row.updates}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400 mb-2">Trader Leaderboard</div>
                {leaderboardRows.length === 0 ? (
                    <div className="text-xs text-slate-500">No traders matched selected segment.</div>
                ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {leaderboardRows.map((row) => (
                            <Link
                                key={row.leadId}
                                href={`/traders/${row.leadId}`}
                                className="flex items-center justify-between rounded border border-slate-800 px-2 py-1.5 hover:bg-slate-900/60 transition-colors"
                            >
                                <div className="text-xs text-slate-200">
                                    <span className="text-slate-500 mr-2">#{row.rank}</span>
                                    <span>{row.nickname}</span>
                                    <span className="text-slate-500 ml-2">[{row.segment}]</span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                                    <span>Score {formatNumber(row.score)}</span>
                                    <span>W {Math.round(row.traderWeight * 100)}%</span>
                                    <span>Q {row.qualityScore ?? '--'}</span>
                                    <span>Lev {formatNumber(row.avgLeverage)}x</span>
                                    <span className={row.realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        PnL {row.realizedPnl >= 0 ? '+' : ''}${formatNumber(row.realizedPnl)}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-2">
            <div className={`text-sm font-semibold ${color}`}>{value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
        </div>
    );
}

function PresetInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: string) => void;
}) {
    return (
        <label className="text-[10px] text-slate-400 space-y-1">
            <div>{label}</div>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
            />
        </label>
    );
}
