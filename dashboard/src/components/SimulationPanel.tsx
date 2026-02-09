'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AutoRunResult,
    AutoTriggerRule,
    BacktestLiteResult,
    closeSimulationPosition,
    formatNumber,
    getAutoTriggerRule,
    getBacktestLite,
    getSimulationPositions,
    getSimulationReport,
    openSimulationPosition,
    reconcileSimulationPositions,
    runAutoSimulation,
    SignalsTimeRange,
    SimulatedPosition,
    SimulationSegment,
    SimulationReport,
    updateAutoTriggerRule,
} from '@/lib/api';

interface SimulationPanelProps {
    symbols: string[];
    preferredSymbol?: string | null;
    viewScope: 'VISIBLE' | 'HIDDEN';
}

interface AutoRuleFormState {
    enabled: boolean;
    segment: SimulationSegment;
    timeRange: SignalsTimeRange;
    minTraders: string;
    minConfidence: string;
    minSentimentAbs: string;
    leverage: string;
    marginNotional: string;
    cooldownMinutes: string;
}

const DEFAULT_RULE_FORM: AutoRuleFormState = {
    enabled: false,
    segment: 'VISIBLE',
    timeRange: '24h',
    minTraders: '2',
    minConfidence: '40',
    minSentimentAbs: '20',
    leverage: '10',
    marginNotional: '100',
    cooldownMinutes: '30',
};

function toRuleForm(rule: AutoTriggerRule): AutoRuleFormState {
    return {
        enabled: rule.enabled,
        segment: rule.segment,
        timeRange: rule.timeRange,
        minTraders: String(rule.minTraders),
        minConfidence: String(rule.minConfidence),
        minSentimentAbs: String(rule.minSentimentAbs),
        leverage: String(rule.leverage),
        marginNotional: String(rule.marginNotional),
        cooldownMinutes: String(rule.cooldownMinutes),
    };
}

function parseIntWithMin(value: string, fallback: number, min: number): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
}

function parseFloatWithMin(value: string, fallback: number, min: number): number {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('tr-TR');
}

export function SimulationPanel({ symbols, preferredSymbol, viewScope }: SimulationPanelProps) {
    const [symbol, setSymbol] = useState('BTCUSDT');
    const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
    const [leverage, setLeverage] = useState('10');
    const [notional, setNotional] = useState('100');
    const [entryPrice, setEntryPrice] = useState('');
    const [notes, setNotes] = useState('');

    const [positions, setPositions] = useState<SimulatedPosition[]>([]);
    const [report, setReport] = useState<SimulationReport | null>(null);
    const [autoRule, setAutoRule] = useState<AutoTriggerRule | null>(null);
    const [ruleForm, setRuleForm] = useState<AutoRuleFormState>(DEFAULT_RULE_FORM);
    const [autoRunResult, setAutoRunResult] = useState<AutoRunResult | null>(null);
    const [backtest, setBacktest] = useState<BacktestLiteResult | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRuleLoading, setIsRuleLoading] = useState(false);
    const [isRuleSaving, setIsRuleSaving] = useState(false);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    const [isBacktestLoading, setIsBacktestLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openPositions = useMemo(
        () => positions.filter((p) => p.status === 'OPEN'),
        [positions],
    );

    const symbolOptions = useMemo(
        () => (symbols.length > 0 ? symbols : ['BTCUSDT']),
        [symbols],
    );

    const refreshData = useCallback(async (withReconcile = false) => {
        setIsLoading(true);
        setError(null);
        try {
            if (withReconcile) {
                await reconcileSimulationPositions();
            }
            const [positionsRes, reportRes] = await Promise.all([
                getSimulationPositions('ALL', 200, false),
                getSimulationReport(),
            ]);
            if (positionsRes.success) setPositions(positionsRes.data);
            if (reportRes.success) setReport(reportRes.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Simulation data fetch failed');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refreshRule = useCallback(async () => {
        setIsRuleLoading(true);
        setError(null);
        try {
            const ruleRes = await getAutoTriggerRule();
            if (ruleRes.success) {
                setAutoRule(ruleRes.data);
                setRuleForm(toRuleForm(ruleRes.data));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Auto rule fetch failed');
        } finally {
            setIsRuleLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshData(true);
        refreshRule();
    }, [refreshData, refreshRule]);

    useEffect(() => {
        const timer = setInterval(() => {
            refreshData(true);
        }, 30000);
        return () => clearInterval(timer);
    }, [refreshData]);

    useEffect(() => {
        const normalized = (preferredSymbol || '').toUpperCase();
        if (normalized && symbolOptions.includes(normalized)) {
            setSymbol(normalized);
        }
    }, [preferredSymbol, symbolOptions]);

    useEffect(() => {
        if (!autoRule) {
            setRuleForm((prev) => ({ ...prev, segment: viewScope }));
        }
    }, [autoRule, viewScope]);

    const onOpen = async () => {
        if (!symbol) return;
        setIsSubmitting(true);
        setError(null);
        try {
            await openSimulationPosition({
                symbol,
                direction,
                leverage: Number(leverage),
                notional: Number(notional),
                entryPrice: entryPrice ? Number(entryPrice) : undefined,
                notes: notes || undefined,
            });
            setEntryPrice('');
            setNotes('');
            await refreshData(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Open simulation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onManualClose = async (id: string) => {
        setIsSubmitting(true);
        setError(null);
        try {
            await closeSimulationPosition(id, { reason: 'MANUAL_CLOSE' });
            await refreshData(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Close simulation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSaveRule = async () => {
        setIsRuleSaving(true);
        setError(null);
        try {
            const payload = {
                enabled: ruleForm.enabled,
                segment: ruleForm.segment,
                timeRange: ruleForm.timeRange,
                minTraders: parseIntWithMin(ruleForm.minTraders, autoRule?.minTraders ?? 2, 1),
                minConfidence: parseIntWithMin(ruleForm.minConfidence, autoRule?.minConfidence ?? 40, 0),
                minSentimentAbs: parseIntWithMin(ruleForm.minSentimentAbs, autoRule?.minSentimentAbs ?? 20, 0),
                leverage: parseFloatWithMin(ruleForm.leverage, autoRule?.leverage ?? 10, 0.1),
                marginNotional: parseFloatWithMin(ruleForm.marginNotional, autoRule?.marginNotional ?? 100, 1),
                cooldownMinutes: parseIntWithMin(ruleForm.cooldownMinutes, autoRule?.cooldownMinutes ?? 30, 0),
            };
            const res = await updateAutoTriggerRule(payload);
            if (res.success) {
                setAutoRule(res.data);
                setRuleForm(toRuleForm(res.data));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Auto rule save failed');
        } finally {
            setIsRuleSaving(false);
        }
    };

    const onRunAuto = async (dryRun: boolean) => {
        setIsAutoRunning(true);
        setError(null);
        try {
            const res = await runAutoSimulation(dryRun);
            if (res.success) {
                setAutoRunResult(res.data);
                setAutoRule(res.data.rule);
                await refreshData(!dryRun);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Auto simulation run failed');
        } finally {
            setIsAutoRunning(false);
        }
    };

    const onRunBacktest = async () => {
        setIsBacktestLoading(true);
        setError(null);
        try {
            const res = await getBacktestLite({
                segment: ruleForm.segment,
                timeRange: ruleForm.timeRange,
                minTraders: parseIntWithMin(ruleForm.minTraders, autoRule?.minTraders ?? 2, 1),
                minConfidence: parseIntWithMin(ruleForm.minConfidence, autoRule?.minConfidence ?? 40, 0),
                minSentimentAbs: parseIntWithMin(ruleForm.minSentimentAbs, autoRule?.minSentimentAbs ?? 20, 0),
                leverage: parseFloatWithMin(ruleForm.leverage, autoRule?.leverage ?? 10, 0.1),
                marginNotional: parseFloatWithMin(ruleForm.marginNotional, autoRule?.marginNotional ?? 100, 1),
            });
            if (res.success) {
                setBacktest(res.data);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Backtest-lite failed');
        } finally {
            setIsBacktestLoading(false);
        }
    };

    return (
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-white font-semibold">Simulation Mode (Faz 4 + Faz 5)</h2>
                    <p className="text-xs text-slate-400">
                        Manual simulation, auto-trigger rule engine, and backtest-lite ({viewScope} view)
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => refreshData(true)}
                    disabled={isLoading || isSubmitting}
                    className="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:text-white disabled:opacity-50"
                >
                    Reconcile + Refresh
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                >
                    {symbolOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as 'LONG' | 'SHORT')}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                >
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                </select>

                <input
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                    placeholder="Leverage"
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                />

                <input
                    value={notional}
                    onChange={(e) => setNotional(e.target.value)}
                    placeholder="Margin USDT"
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                />

                <input
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="Entry (optional)"
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                />

                <button
                    type="button"
                    onClick={onOpen}
                    disabled={isSubmitting || isLoading}
                    className={`text-xs rounded px-2 py-1.5 border ${
                        direction === 'LONG'
                            ? 'border-green-600/50 text-green-400'
                            : 'border-red-600/50 text-red-400'
                    } disabled:opacity-50`}
                >
                    Open Sim
                </button>
            </div>

            <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
            />

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <div className="text-sm text-white font-medium">Auto Trigger Rule (Faz 5)</div>
                        <div className="text-[11px] text-slate-500">
                            Last run: {formatDateTime(autoRule?.lastRunAt)} {autoRule?.enabled ? '(enabled)' : '(disabled)'}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={refreshRule}
                        disabled={isRuleLoading || isRuleSaving || isAutoRunning}
                        className="text-[11px] px-2.5 py-1 rounded border border-slate-600 text-slate-300 hover:text-white disabled:opacity-50"
                    >
                        Reload Rule
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <label className="flex items-center gap-2 rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-200">
                        <input
                            type="checkbox"
                            checked={ruleForm.enabled}
                            onChange={(e) => setRuleForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                            className="accent-blue-500"
                        />
                        Rule Enabled
                    </label>

                    <select
                        value={ruleForm.segment}
                        onChange={(e) => setRuleForm((prev) => ({ ...prev, segment: e.target.value as SimulationSegment }))}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    >
                        <option value="VISIBLE">VISIBLE</option>
                        <option value="HIDDEN">HIDDEN</option>
                        <option value="BOTH">BOTH</option>
                    </select>

                    <select
                        value={ruleForm.timeRange}
                        onChange={(e) => setRuleForm((prev) => ({ ...prev, timeRange: e.target.value as SignalsTimeRange }))}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    >
                        <option value="1h">1h</option>
                        <option value="4h">4h</option>
                        <option value="24h">24h</option>
                        <option value="7d">7d</option>
                        <option value="ALL">ALL</option>
                    </select>

                    <input
                        value={ruleForm.minTraders}
                        onChange={(e) => setRuleForm((prev) => ({ ...prev, minTraders: e.target.value }))}
                        placeholder="Min Traders"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />

                    <input
                        value={ruleForm.minConfidence}
                        onChange={(e) => setRuleForm((prev) => ({ ...prev, minConfidence: e.target.value }))}
                        placeholder="Min Confidence"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />

                    <input
                        value={ruleForm.minSentimentAbs}
                        onChange={(e) => setRuleForm((prev) => ({ ...prev, minSentimentAbs: e.target.value }))}
                        placeholder="Min Sentiment %"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />

                    <input
                        value={ruleForm.leverage}
                        onChange={(e) => setRuleForm((prev) => ({ ...prev, leverage: e.target.value }))}
                        placeholder="Leverage"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />

                    <input
                        value={ruleForm.marginNotional}
                        onChange={(e) => setRuleForm((prev) => ({ ...prev, marginNotional: e.target.value }))}
                        placeholder="Margin USDT"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />

                    <input
                        value={ruleForm.cooldownMinutes}
                        onChange={(e) => setRuleForm((prev) => ({ ...prev, cooldownMinutes: e.target.value }))}
                        placeholder="Cooldown (m)"
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onSaveRule}
                        disabled={isRuleLoading || isRuleSaving || isAutoRunning}
                        className="text-xs rounded px-2.5 py-1.5 border border-blue-600/50 text-blue-400 disabled:opacity-50"
                    >
                        Save Rule
                    </button>
                    <button
                        type="button"
                        onClick={() => onRunAuto(false)}
                        disabled={isRuleLoading || isRuleSaving || isAutoRunning}
                        className="text-xs rounded px-2.5 py-1.5 border border-emerald-600/50 text-emerald-400 disabled:opacity-50"
                    >
                        Run Auto
                    </button>
                    <button
                        type="button"
                        onClick={() => onRunAuto(true)}
                        disabled={isRuleLoading || isRuleSaving || isAutoRunning}
                        className="text-xs rounded px-2.5 py-1.5 border border-yellow-600/50 text-yellow-300 disabled:opacity-50"
                    >
                        Dry Run
                    </button>
                    <button
                        type="button"
                        onClick={onRunBacktest}
                        disabled={isRuleLoading || isRuleSaving || isBacktestLoading}
                        className="text-xs rounded px-2.5 py-1.5 border border-violet-600/50 text-violet-300 disabled:opacity-50"
                    >
                        Backtest Lite
                    </button>
                </div>
            </div>

            {error && (
                <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded px-2 py-1.5">
                    {error}
                </div>
            )}

            {report && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                    <Stat label="Open" value={report.totals.open} color="text-yellow-300" />
                    <Stat label="Closed" value={report.totals.closed} color="text-slate-200" />
                    <Stat label="WinRate" value={`${report.totals.winRate.toFixed(1)}%`} color="text-green-400" />
                    <Stat label="Total PnL" value={`$${formatNumber(report.totals.totalPnl)}`} color={report.totals.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
                    <Stat label="Avg PnL" value={`$${formatNumber(report.totals.avgPnl)}`} color={report.totals.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
                    <Stat label="Avg ROI" value={`${report.totals.avgRoiPct.toFixed(2)}%`} color={report.totals.avgRoiPct >= 0 ? 'text-green-400' : 'text-red-400'} />
                </div>
            )}

            {autoRunResult && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                    <div className="text-xs text-slate-400">Auto Run Result</div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                        <Stat label="Candidates" value={autoRunResult.candidates.length} color="text-slate-200" />
                        <Stat label="Opened" value={autoRunResult.openedCount} color="text-green-400" />
                        <Stat label="Closed" value={autoRunResult.closedCount} color="text-red-400" />
                        <Stat label="Reconciled" value={autoRunResult.reconciledCount} color="text-blue-400" />
                        <Stat label="Skipped" value={autoRunResult.skippedCount} color="text-yellow-300" />
                        <Stat label="Status" value={autoRunResult.status || 'ok'} color="text-slate-300" />
                    </div>
                    {autoRunResult.skipped.length > 0 && (
                        <div className="text-[11px] text-slate-500">
                            Skips: {autoRunResult.skipped.slice(0, 5).map((s) => `${s.symbol}:${s.reason}`).join(' | ')}
                        </div>
                    )}
                </div>
            )}

            {backtest && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                    <div className="text-xs text-slate-400">Backtest Lite</div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                        <Stat label="Trades" value={backtest.summary.trades} color="text-slate-200" />
                        <Stat label="WinRate" value={`${backtest.summary.winRate.toFixed(1)}%`} color="text-green-400" />
                        <Stat
                            label="Total PnL"
                            value={`$${formatNumber(backtest.summary.totalPnl)}`}
                            color={backtest.summary.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}
                        />
                        <Stat
                            label="Avg PnL"
                            value={`$${formatNumber(backtest.summary.avgPnl)}`}
                            color={backtest.summary.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}
                        />
                        <Stat
                            label="Avg ROI"
                            value={`${backtest.summary.avgRoiPct.toFixed(2)}%`}
                            color={backtest.summary.avgRoiPct >= 0 ? 'text-green-400' : 'text-red-400'}
                        />
                        <Stat label="Range" value={backtest.config.timeRange} color="text-slate-300" />
                    </div>
                    {backtest.bySymbol.length > 0 && (
                        <div className="max-h-36 overflow-y-auto space-y-1">
                            {backtest.bySymbol.slice(0, 8).map((row) => (
                                <div key={row.symbol} className="flex items-center justify-between text-[11px] text-slate-300 border border-slate-800 rounded px-2 py-1">
                                    <span className="font-mono">{row.symbol}</span>
                                    <span>{row.trades} trades</span>
                                    <span className={row.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        ${formatNumber(row.totalPnl)}
                                    </span>
                                    <span>{row.winRate.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div>
                <div className="text-xs text-slate-400 mb-2">Open Sim Positions ({openPositions.length})</div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {openPositions.length === 0 && (
                        <div className="text-xs text-slate-500">No open simulation positions.</div>
                    )}
                    {openPositions.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5">
                            <div className="text-xs text-slate-300">
                                <span className="font-mono text-white">{p.symbol}</span>{' '}
                                <span className={p.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}>
                                    {p.direction}
                                </span>{' '}
                                <span>{p.leverage}x</span>{' '}
                                <span className="text-slate-500">Entry ${formatNumber(p.entryPrice)}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => onManualClose(p.id)}
                                disabled={isSubmitting}
                                className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-300 hover:text-white disabled:opacity-50"
                            >
                                Manual Close
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-2">
            <div className={`text-sm font-semibold ${color}`}>{value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
        </div>
    );
}
