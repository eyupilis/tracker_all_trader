import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';
import { computeTraderMetrics } from '../services/traderMetrics.js';
import { computeTraderWeight } from '../services/traderWeight.js';
// Sprint 2: Advanced analytics services
import { computeAdvancedMetrics } from '../services/advancedMetrics.js';
import { runMonteCarloSimulation } from '../services/monteCarlo.js';
import { runWalkForwardAnalysis } from '../services/walkForward.js';
import { generateEquityCurve } from '../services/equityCurve.js';
// Yol 2: Position state tracking
import {
    getActivePositionStates,
    getPositionStateHistory,
    getRecentlyClosedPositions,
    calculateUncertaintyRange
} from '../services/positionState.js';
// Leverage estimation for hidden traders
import { batchEstimateLeverages } from '../services/leverageEstimation.js';
// Trader performance metrics
import { batchCalculatePerformance } from '../services/traderPerformance.js';

interface HeatmapQuery {
    timeRange?: string;      // 1h, 4h, 24h, 7d, ALL
    side?: string;           // ALL, LONG, SHORT
    minTraders?: string;     // minimum traders per symbol
    leverage?: string;       // ALL, <20x, 20-50x, 50-100x, >100x
    segment?: string;        // VISIBLE, HIDDEN, BOTH
    recentlyOpened?: string; // YOL 2: 10m, 30m, 1h, 6h - filter to positions opened in last X
}

interface SymbolQuery {
    timeRange?: string;
    segment?: string;    // VISIBLE, HIDDEN, BOTH
}

interface FeedQuery {
    source?: string;    // all, positions, derived
    limit?: string;     // max records to return
    symbol?: string;    // optional symbol filter (e.g. BTCUSDT)
    timeRange?: string; // 1h, 4h, 24h, 7d, ALL
    segment?: string;   // VISIBLE, HIDDEN, BOTH
}

interface InsightsQuery {
    timeRange?: string; // 1h, 4h, 24h, 7d, ALL
    segment?: string;   // VISIBLE, HIDDEN, BOTH
    top?: string;       // leaderboard rows (max 50)
    mode?: string;      // conservative, balanced, aggressive
}

interface InsightsRuleUpdateBody {
    defaultMode?: string;
    presets?: {
        conservative?: Partial<InsightsPresetConfig>;
        balanced?: Partial<InsightsPresetConfig>;
        aggressive?: Partial<InsightsPresetConfig>;
    };
}

interface SimulationPositionsQuery {
    status?: string; // OPEN, CLOSED, ALL
    limit?: string;
    reconcile?: string; // true to run auto-close before listing
}

interface SimulationOpenBody {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    leverage?: number;
    notional?: number;
    entryPrice?: number;
    notes?: string;
}

interface SimulationCloseBody {
    exitPrice?: number;
    reason?: string;
}

interface AutoRuleUpdateBody {
    enabled?: boolean;
    segment?: 'VISIBLE' | 'HIDDEN' | 'BOTH';
    timeRange?: '1h' | '4h' | '24h' | '7d' | 'ALL';
    minTraders?: number;
    minConfidence?: number;
    minSentimentAbs?: number;
    leverage?: number;
    marginNotional?: number;
    cooldownMinutes?: number;
}

interface AutoRunQuery {
    dryRun?: string;
}

interface BacktestLiteQuery {
    timeRange?: string;
    minTraders?: string;
    minConfidence?: string;
    minSentimentAbs?: string;
    leverage?: string;
    marginNotional?: string;
    segment?: string;
    // Sprint 2: Advanced analytics flags
    advancedMetrics?: string;
    monteCarlo?: string;
    walkForward?: string;
    equityCurve?: string;
    numSimulations?: string;
    persist?: string;
}

interface AggregatedPosition {
    symbol: string;
    longCount: number;
    shortCount: number;
    totalTraders: number;
    avgLeverage: number;
    totalVolume: number;
    longVolume: number;
    shortVolume: number;
    derivedConfidenceSum: number;
    derivedTraderCount: number;
    visibleTraderCount: number;
    hiddenTraderCount: number;
    traders: TraderPosition[];
}

interface TraderPosition {
    leadId: string;
    nickname: string;
    avatarUrl: string;
    side: 'LONG' | 'SHORT';
    leverage: number;
    entryPrice: number;
    markPrice: number;
    size: number;
    pnl: number;
    pnlPercent: number;
    roe?: number; // YOL 2: Return on Equity
    traderWeight: number | null;
    segment: 'VISIBLE' | 'HIDDEN' | 'UNKNOWN' | null;
    qualityScore: number | null;
    confidence: 'low' | 'medium' | 'high' | null;
    winRate: number | null;
    isDerived?: boolean;
    derivedConfidence?: number | null;
    lastAction?: string | null;
    // YOL 2: Position timing data
    openedAt?: string | null;
    holdDurationSeconds?: number | null;
}

type TraderSegment = 'VISIBLE' | 'HIDDEN' | 'UNKNOWN';
type TraderSegmentFilter = 'VISIBLE' | 'HIDDEN' | 'BOTH';

interface DerivedSymbolState {
    symbol: string;
    side: 'LONG' | 'SHORT' | null;
    entryPrice: number;
    notional: number;
    confidence: number; // 0..1
    lastAction: string | null;
    lastEventTime: number;
}

// FAZ 1: Consensus computation helpers
function normalizePositionSide(
    rawSide: unknown,
    rawAmount: unknown
): 'LONG' | 'SHORT' | null {
    if (rawSide === 'LONG' || rawSide === 'SHORT') {
        return rawSide;
    }
    if (rawSide === 'BOTH') {
        const amount = parseFloat(String(rawAmount ?? '0'));
        if (amount > 0) return 'LONG';
        if (amount < 0) return 'SHORT';
        return null;
    }
    return null;
}

function computeSentimentScore(longWeight: number, shortWeight: number): number {
    const totalWeight = longWeight + shortWeight;
    if (totalWeight === 0) return 0;
    return (longWeight - shortWeight) / totalWeight; // -1..+1
}

function computeConfidenceScore(
    sentimentScore: number,
    totalTraders: number,
    sumWeights: number,
): number {
    // confidenceScore = |sentiment| × traderCoverage × weightCoverage × 100
    // traderCoverage: ramps up from 0 at 1 trader to 1 at 3+ traders
    // weightCoverage: ramps up to 1 at sumWeights >= 0.5
    const traderCoverage = Math.min(totalTraders / 3, 1);
    const weightCoverage = Math.min(sumWeights / 0.5, 1);
    return Math.round(Math.abs(sentimentScore) * traderCoverage * weightCoverage * 100);
}

function getConsensusDirection(sentimentScore: number): 'LONG' | 'SHORT' | 'NEUTRAL' {
    if (sentimentScore > 0.05) return 'LONG';
    if (sentimentScore < -0.05) return 'SHORT';
    return 'NEUTRAL';
}

// Helper to get time range filter
function getTimeRangeMs(timeRange: string): number {
    switch (timeRange) {
        case '1h': return 60 * 60 * 1000;
        case '4h': return 4 * 60 * 60 * 1000;
        case '24h': return 24 * 60 * 60 * 1000;
        case '7d': return 7 * 24 * 60 * 60 * 1000;
        case 'ALL': return Infinity;
        default: return 24 * 60 * 60 * 1000; // default 24h
    }
}

// YOL 2: Parse recentlyOpened time window (e.g., "10m", "30m", "1h", "6h")
function parseRecentlyOpenedMs(recentlyOpened: string): number | null {
    const match = recentlyOpened.match(/^(\d+)(m|h|d)$/);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 'm': return value * 60 * 1000;           // minutes
        case 'h': return value * 60 * 60 * 1000;      // hours
        case 'd': return value * 24 * 60 * 60 * 1000; // days
        default: return null;
    }
}

// Helper to filter by leverage
function filterByLeverage(leverage: number, leverageFilter: string): boolean {
    if (leverageFilter === 'ALL') return true;
    if (leverageFilter === '<20x') return leverage < 20;
    if (leverageFilter === '20-50x') return leverage >= 20 && leverage <= 50;
    if (leverageFilter === '50-100x') return leverage > 50 && leverage <= 100;
    if (leverageFilter === '>100x') return leverage > 100;
    return true;
}

function parseSegmentFilter(raw: string | undefined): TraderSegmentFilter {
    if (raw === 'VISIBLE' || raw === 'HIDDEN' || raw === 'BOTH') return raw;
    return 'BOTH';
}

function resolveSegment(positionShow: boolean | null | undefined): TraderSegment {
    if (positionShow === true) return 'VISIBLE';
    if (positionShow === false) return 'HIDDEN';
    return 'UNKNOWN';
}

function shouldIncludeSegment(segment: TraderSegment, filter: TraderSegmentFilter): boolean {
    if (filter === 'BOTH') return true;
    if (filter === 'HIDDEN') return segment === 'HIDDEN';
    return segment === 'VISIBLE' || segment === 'UNKNOWN';
}

// YOL 2: Format duration in human-readable form
function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function getOrderActionNormalized(side: string, positionSide: string): 'OPEN_LONG' | 'CLOSE_LONG' | 'OPEN_SHORT' | 'CLOSE_SHORT' | 'UNKNOWN' {
    if (side === 'BUY' && positionSide === 'LONG') return 'OPEN_LONG';
    if (side === 'SELL' && positionSide === 'LONG') return 'CLOSE_LONG';
    if (side === 'SELL' && positionSide === 'SHORT') return 'OPEN_SHORT';
    if (side === 'BUY' && positionSide === 'SHORT') return 'CLOSE_SHORT';
    return 'UNKNOWN';
}

function deriveHiddenStatesFromOrders(
    orders: any[],
    cutoffMs: number,
): Map<string, DerivedSymbolState> {
    const bySymbol = new Map<string, any[]>();
    for (const order of orders || []) {
        const symbol = String(order?.symbol || '').toUpperCase();
        const ts = Number(order?.orderTime || 0);
        if (!symbol || !ts) continue;
        if (cutoffMs !== 0 && ts < cutoffMs) continue;
        const list = bySymbol.get(symbol) || [];
        list.push(order);
        bySymbol.set(symbol, list);
    }

    const states = new Map<string, DerivedSymbolState>();
    for (const [symbol, symbolOrders] of bySymbol) {
        const sorted = [...symbolOrders].sort((a, b) => Number(a.orderTime || 0) - Number(b.orderTime || 0));
        let side: 'LONG' | 'SHORT' | null = null;
        let entryPrice = 0;
        let notional = 0;
        let supportEvents = 0;
        let contradictionEvents = 0;
        let closeWithoutOpen = 0;
        let lastAction: string | null = null;
        let lastEventTime = 0;

        for (const order of sorted) {
            const action = getOrderActionNormalized(String(order?.side || ''), String(order?.positionSide || ''));
            const qty = parseFloat(String(order?.executedQty || '0'));
            const avgPrice = parseFloat(String(order?.avgPrice || '0'));
            const orderNotional = Math.abs(qty * avgPrice);
            const ts = Number(order?.orderTime || 0);
            if (ts > lastEventTime) lastEventTime = ts;
            lastAction = action;

            if (action === 'OPEN_LONG') {
                if (side === 'SHORT') contradictionEvents++;
                side = 'LONG';
                entryPrice = avgPrice || entryPrice;
                notional = orderNotional || notional;
                supportEvents++;
                continue;
            }
            if (action === 'OPEN_SHORT') {
                if (side === 'LONG') contradictionEvents++;
                side = 'SHORT';
                entryPrice = avgPrice || entryPrice;
                notional = orderNotional || notional;
                supportEvents++;
                continue;
            }
            if (action === 'CLOSE_LONG') {
                if (side === 'LONG') {
                    side = null;
                } else {
                    closeWithoutOpen++;
                }
                continue;
            }
            if (action === 'CLOSE_SHORT') {
                if (side === 'SHORT') {
                    side = null;
                } else {
                    closeWithoutOpen++;
                }
                continue;
            }
        }

        if (!side) continue;

        // Heuristic confidence for derived hidden state.
        let confidence = 0.55;
        confidence += Math.min(supportEvents, 3) * 0.08;
        confidence -= Math.min(contradictionEvents, 2) * 0.12;
        confidence -= Math.min(closeWithoutOpen, 2) * 0.1;
        if (lastAction === 'OPEN_LONG' || lastAction === 'OPEN_SHORT') confidence += 0.08;
        const ageMs = lastEventTime > 0 ? Date.now() - lastEventTime : Number.MAX_SAFE_INTEGER;
        if (ageMs <= 60 * 60 * 1000) confidence += 0.12;
        else if (ageMs <= 24 * 60 * 60 * 1000) confidence += 0.06;
        else if (ageMs > 7 * 24 * 60 * 60 * 1000) confidence -= 0.1;
        confidence = Math.min(0.95, Math.max(0.2, confidence));

        states.set(symbol, {
            symbol,
            side,
            entryPrice,
            notional,
            confidence,
            lastAction,
            lastEventTime,
        });
    }

    return states;
}

type SimulationStatusFilter = 'OPEN' | 'CLOSED' | 'ALL';

function parseSimulationStatus(raw: string | undefined): SimulationStatusFilter {
    if (raw === 'OPEN' || raw === 'CLOSED' || raw === 'ALL') return raw;
    return 'ALL';
}

function round4(value: number): number {
    return Math.round(value * 10000) / 10000;
}

function computeSimulationPerformance(params: {
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    leverage: number;
    marginNotional: number;
}) {
    const { direction, entryPrice, exitPrice, leverage, marginNotional } = params;
    if (entryPrice <= 0 || marginNotional <= 0) {
        return { positionNotional: 0, pnlUSDT: 0, roiPct: 0 };
    }
    const positionNotional = marginNotional * Math.max(leverage, 1);
    const rawMove =
        direction === 'LONG'
            ? (exitPrice - entryPrice) / entryPrice
            : (entryPrice - exitPrice) / entryPrice;
    const pnlUSDT = positionNotional * rawMove;
    const roiPct = marginNotional > 0 ? (pnlUSDT / marginNotional) * 100 : 0;
    return {
        positionNotional: round4(positionNotional),
        pnlUSDT: round4(pnlUSDT),
        roiPct: round4(roiPct),
    };
}

async function getReferenceEntryPrice(symbol: string): Promise<number | null> {
    const s = symbol.toUpperCase();
    const latestPositions = await prisma.positionSnapshot.findMany({
        where: { symbol: s, platform: 'binance' },
        orderBy: { fetchedAt: 'desc' },
        take: 60,
        select: { markPrice: true, entryPrice: true },
    });
    const prices = latestPositions
        .map((p) => (p.markPrice && p.markPrice > 0 ? p.markPrice : p.entryPrice))
        .filter((v): v is number => Number.isFinite(v) && v > 0);
    if (prices.length > 0) {
        const avg = prices.reduce((sum, v) => sum + v, 0) / prices.length;
        return round4(avg);
    }

    const latestEvent = await prisma.event.findFirst({
        where: { symbol: s, platform: 'binance', price: { not: null } },
        orderBy: [{ eventTime: 'desc' }, { fetchedAt: 'desc' }],
        select: { price: true },
    });
    if (latestEvent?.price && latestEvent.price > 0) {
        return round4(latestEvent.price);
    }
    return null;
}

async function findFirstCloseEventForSimulation(position: {
    symbol: string;
    direction: string;
    openedAt: Date;
}) {
    const targetEventType = position.direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
    const rows = await prisma.$queryRaw<Array<{
        leadId: string;
        eventType: string;
        eventTs: Date;
        price: number | null;
    }>>`
      SELECT
        "leadId",
        "eventType",
        COALESCE("eventTime", "fetchedAt") as "eventTs",
        price
      FROM "Event"
      WHERE platform = 'binance'
        AND symbol = ${position.symbol}
        AND "eventType" = ${targetEventType}
        AND COALESCE("eventTime", "fetchedAt") >= ${position.openedAt}
      ORDER BY COALESCE("eventTime", "fetchedAt") ASC
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return rows[0];
}

interface ConsensusSnapshotItem {
    symbol: string;
    longCount: number;
    shortCount: number;
    totalTraders: number;
    longWeight: number;
    shortWeight: number;
    sentimentScore: number;
    consensusDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
    confidenceScore: number;
}

type InsightAnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH';
type InsightsMode = 'conservative' | 'balanced' | 'aggressive';

interface InsightsPresetConfig {
    crowdedMinTraders: number;
    crowdedMinConfidence: number;
    crowdedMinSentimentAbs: number;
    lowConfidenceLimit: number;
    highLeverageThreshold: number;
    extremeLeverageThreshold: number;
    unstableMinFlips: number;
    unstableHighFlips: number;
    unstableMinUpdates: number;
    scoreMultiplier: number;
}

const DEFAULT_INSIGHTS_PRESETS: Record<InsightsMode, InsightsPresetConfig> = {
    conservative: {
        crowdedMinTraders: 4,
        crowdedMinConfidence: 78,
        crowdedMinSentimentAbs: 90,
        lowConfidenceLimit: 25,
        highLeverageThreshold: 60,
        extremeLeverageThreshold: 95,
        unstableMinFlips: 3,
        unstableHighFlips: 4,
        unstableMinUpdates: 5,
        scoreMultiplier: 0.9,
    },
    balanced: {
        crowdedMinTraders: 3,
        crowdedMinConfidence: 70,
        crowdedMinSentimentAbs: 85,
        lowConfidenceLimit: 30,
        highLeverageThreshold: 50,
        extremeLeverageThreshold: 85,
        unstableMinFlips: 2,
        unstableHighFlips: 3,
        unstableMinUpdates: 4,
        scoreMultiplier: 1,
    },
    aggressive: {
        crowdedMinTraders: 2,
        crowdedMinConfidence: 60,
        crowdedMinSentimentAbs: 75,
        lowConfidenceLimit: 35,
        highLeverageThreshold: 40,
        extremeLeverageThreshold: 70,
        unstableMinFlips: 2,
        unstableHighFlips: 2,
        unstableMinUpdates: 3,
        scoreMultiplier: 1.15,
    },
};

interface NormalizedInsightsRule {
    id: string;
    platform: string;
    defaultMode: InsightsMode;
    presets: Record<InsightsMode, InsightsPresetConfig>;
    createdAt: Date;
    updatedAt: Date;
}

function getAnomalySeverityRank(severity: InsightAnomalySeverity): number {
    if (severity === 'HIGH') return 3;
    if (severity === 'MEDIUM') return 2;
    return 1;
}

function normalizeTimeRange(raw: string | undefined): '1h' | '4h' | '24h' | '7d' | 'ALL' {
    if (raw === '1h' || raw === '4h' || raw === '24h' || raw === '7d' || raw === 'ALL') {
        return raw;
    }
    return '24h';
}

function normalizeInsightsMode(raw: string | undefined): InsightsMode {
    if (raw === 'conservative' || raw === 'balanced' || raw === 'aggressive') {
        return raw;
    }
    return 'balanced';
}

function parseTopLimit(raw: string | undefined, fallback = 10): number {
    const parsed = parseInt(raw || String(fallback), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(3, Math.min(50, parsed));
}

function toNumeric(raw: unknown): number | null {
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return value;
}

function sanitizeInsightsPreset(
    raw: unknown,
    fallback: InsightsPresetConfig,
): InsightsPresetConfig {
    const src = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};

    const toIntRange = (field: keyof InsightsPresetConfig, min: number, max: number) => {
        const numeric = toNumeric(src[field]);
        if (numeric === null) return fallback[field] as number;
        return Math.round(Math.max(min, Math.min(max, numeric)));
    };
    const toFloatRange = (field: keyof InsightsPresetConfig, min: number, max: number) => {
        const numeric = toNumeric(src[field]);
        if (numeric === null) return fallback[field] as number;
        return round4(Math.max(min, Math.min(max, numeric)));
    };

    return {
        crowdedMinTraders: toIntRange('crowdedMinTraders', 1, 20),
        crowdedMinConfidence: toIntRange('crowdedMinConfidence', 0, 100),
        crowdedMinSentimentAbs: toIntRange('crowdedMinSentimentAbs', 0, 100),
        lowConfidenceLimit: toIntRange('lowConfidenceLimit', 0, 100),
        highLeverageThreshold: toFloatRange('highLeverageThreshold', 1, 300),
        extremeLeverageThreshold: toFloatRange('extremeLeverageThreshold', 1, 500),
        unstableMinFlips: toIntRange('unstableMinFlips', 1, 20),
        unstableHighFlips: toIntRange('unstableHighFlips', 1, 20),
        unstableMinUpdates: toIntRange('unstableMinUpdates', 1, 100),
        scoreMultiplier: toFloatRange('scoreMultiplier', 0.1, 3),
    };
}

function normalizeInsightsRule(row: {
    id: string;
    platform: string;
    defaultMode: string;
    conservativePreset: unknown;
    balancedPreset: unknown;
    aggressivePreset: unknown;
    createdAt: Date;
    updatedAt: Date;
}): NormalizedInsightsRule {
    return {
        id: row.id,
        platform: row.platform,
        defaultMode: normalizeInsightsMode(row.defaultMode),
        presets: {
            conservative: sanitizeInsightsPreset(
                row.conservativePreset,
                DEFAULT_INSIGHTS_PRESETS.conservative,
            ),
            balanced: sanitizeInsightsPreset(
                row.balancedPreset,
                DEFAULT_INSIGHTS_PRESETS.balanced,
            ),
            aggressive: sanitizeInsightsPreset(
                row.aggressivePreset,
                DEFAULT_INSIGHTS_PRESETS.aggressive,
            ),
        },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

async function computeLiveConsensusSnapshot(params: {
    timeRange: string;
    segmentFilter: TraderSegmentFilter;
}) {
    const timeRangeMs = getTimeRangeMs(params.timeRange);
    const cutoffTime = timeRangeMs === Infinity
        ? new Date(0)
        : new Date(Date.now() - timeRangeMs);
    const cutoffMs = cutoffTime.getTime();

    const latestIngests = timeRangeMs === Infinity
        ? await prisma.$queryRaw<Array<{ leadId: string; payload: any }>>`
      SELECT DISTINCT ON ("leadId") "leadId", payload
      FROM "RawIngest"
      ORDER BY "leadId", "fetchedAt" DESC
    `
        : await prisma.$queryRaw<Array<{ leadId: string; payload: any }>>`
      SELECT DISTINCT ON ("leadId") "leadId", payload
      FROM "RawIngest"
      WHERE "fetchedAt" >= ${cutoffTime}
      ORDER BY "leadId", "fetchedAt" DESC
    `;

    const leadIds = latestIngests.map((i) => i.leadId);
    const [leadTraders, traderScores] = await Promise.all([
        prisma.leadTrader.findMany({
            where: { id: { in: leadIds } },
            select: { id: true, positionShow: true },
        }),
        prisma.traderScore.findMany({
            where: { leadId: { in: leadIds } },
            select: { leadId: true, traderWeight: true },
        }),
    ]);
    const segmentMap = new Map(leadTraders.map((t) => [t.id, resolveSegment(t.positionShow)]));
    const weightMap = new Map(traderScores.map((s) => [s.leadId, s.traderWeight ?? 0]));

    const agg = new Map<string, {
        longCount: number;
        shortCount: number;
        totalTraders: number;
        longWeight: number;
        shortWeight: number;
    }>();

    const applySignal = (symbolRaw: unknown, side: 'LONG' | 'SHORT', weight: number) => {
        const symbol = String(symbolRaw || '').toUpperCase();
        if (!symbol) return;
        if (!agg.has(symbol)) {
            agg.set(symbol, {
                longCount: 0,
                shortCount: 0,
                totalTraders: 0,
                longWeight: 0,
                shortWeight: 0,
            });
        }
        const row = agg.get(symbol)!;
        if (side === 'LONG') {
            row.longCount += 1;
            row.longWeight += weight;
        } else {
            row.shortCount += 1;
            row.shortWeight += weight;
        }
        row.totalTraders += 1;
    };

    for (const ingest of latestIngests) {
        const payload = ingest.payload || {};
        const segment = segmentMap.get(ingest.leadId) ?? 'UNKNOWN';
        if (!shouldIncludeSegment(segment, params.segmentFilter)) continue;
        const traderWeight = weightMap.get(ingest.leadId) ?? 0;

        if (segment !== 'HIDDEN') {
            const positions = payload.activePositions || [];
            for (const pos of positions) {
                const normalizedSide = normalizePositionSide(pos.positionSide, pos.positionAmount);
                if (!normalizedSide) continue;
                applySignal(pos.symbol, normalizedSide, traderWeight);
            }
            continue;
        }

        const orders = payload.orderHistory?.allOrders || [];
        const hiddenStates = deriveHiddenStatesFromOrders(orders, timeRangeMs === Infinity ? 0 : cutoffMs);
        for (const state of hiddenStates.values()) {
            if (!state.side) continue;
            applySignal(state.symbol, state.side, traderWeight);
        }
    }

    const result: ConsensusSnapshotItem[] = [];
    for (const [symbol, row] of agg.entries()) {
        const sentimentScore = computeSentimentScore(row.longWeight, row.shortWeight);
        const sumWeights = row.longWeight + row.shortWeight;
        const confidenceScore = computeConfidenceScore(sentimentScore, row.totalTraders, sumWeights);
        result.push({
            symbol,
            longCount: row.longCount,
            shortCount: row.shortCount,
            totalTraders: row.totalTraders,
            longWeight: round4(row.longWeight),
            shortWeight: round4(row.shortWeight),
            sentimentScore: round4(sentimentScore),
            consensusDirection: getConsensusDirection(sentimentScore),
            confidenceScore,
        });
    }

    result.sort((a, b) => b.confidenceScore - a.confidenceScore || b.totalTraders - a.totalTraders);
    return result;
}

async function getOrCreateAutoTriggerRule() {
    const existing = await prisma.autoTriggerRule.findUnique({ where: { id: 'default' } });
    if (existing) return existing;
    return prisma.autoTriggerRule.create({
        data: {
            id: 'default',
            platform: 'binance',
            enabled: false,
            segment: 'VISIBLE',
            timeRange: '24h',
            minTraders: 2,
            minConfidence: 40,
            minSentimentAbs: 20,
            leverage: 10,
            marginNotional: 100,
            cooldownMinutes: 30,
        },
    });
}

async function getOrCreateInsightsRule() {
    const existing = await prisma.insightsRule.findUnique({ where: { id: 'default' } });
    if (existing) return existing;
    return prisma.insightsRule.create({
        data: {
            id: 'default',
            platform: 'binance',
            defaultMode: 'balanced',
            conservativePreset: DEFAULT_INSIGHTS_PRESETS.conservative as unknown as Prisma.InputJsonValue,
            balancedPreset: DEFAULT_INSIGHTS_PRESETS.balanced as unknown as Prisma.InputJsonValue,
            aggressivePreset: DEFAULT_INSIGHTS_PRESETS.aggressive as unknown as Prisma.InputJsonValue,
        },
    });
}

function parseBool(raw: string | undefined): boolean {
    return raw === '1' || raw === 'true' || raw === 'yes';
}

export async function signalsRoutes(fastify: FastifyInstance) {
    async function reconcileOpenSimulatedPositions() {
        const openPositions = await prisma.simulatedPosition.findMany({
            where: { platform: 'binance', status: 'OPEN' },
            orderBy: { openedAt: 'asc' },
            take: 500,
        });

        const closed: any[] = [];
        for (const pos of openPositions) {
            const closeEvent = await findFirstCloseEventForSimulation({
                symbol: pos.symbol,
                direction: pos.direction,
                openedAt: pos.openedAt,
            });
            if (!closeEvent) continue;

            const exitPrice = closeEvent.price && closeEvent.price > 0
                ? closeEvent.price
                : pos.entryPrice;
            const perf = computeSimulationPerformance({
                direction: pos.direction as 'LONG' | 'SHORT',
                entryPrice: pos.entryPrice,
                exitPrice,
                leverage: pos.leverage,
                marginNotional: pos.marginNotional,
            });

            const updated = await prisma.simulatedPosition.update({
                where: { id: pos.id },
                data: {
                    status: 'CLOSED',
                    exitPrice,
                    closedAt: closeEvent.eventTs,
                    closeReason: 'FIRST_TRADER_CLOSE',
                    closeTriggerLeadId: closeEvent.leadId,
                    closeTriggerEventType: closeEvent.eventType,
                    pnlUSDT: perf.pnlUSDT,
                    roiPct: perf.roiPct,
                    positionNotional: perf.positionNotional,
                },
            });
            closed.push(updated);
        }

        return closed;
    }

    async function runAutoTriggerEngine(options: { dryRun: boolean }) {
        const rule = await getOrCreateAutoTriggerRule();
        const segmentFilter = parseSegmentFilter(rule.segment);

        if (!rule.enabled && !options.dryRun) {
            return {
                rule,
                reconciledCount: 0,
                openedCount: 0,
                closedCount: 0,
                skippedCount: 0,
                opened: [],
                closed: [],
                skipped: [],
                candidates: [],
                status: 'rule_disabled',
            };
        }

        const reconciled = options.dryRun ? [] : await reconcileOpenSimulatedPositions();
        const snapshot = await computeLiveConsensusSnapshot({
            timeRange: rule.timeRange,
            segmentFilter,
        });

        const openAutoPositions = await prisma.simulatedPosition.findMany({
            where: { platform: 'binance', status: 'OPEN', source: 'AUTO' },
            orderBy: { openedAt: 'desc' },
        });
        const openBySymbol = new Map(openAutoPositions.map((p) => [p.symbol, p]));

        const recentAuto = await prisma.simulatedPosition.findMany({
            where: { platform: 'binance', source: 'AUTO' },
            orderBy: { openedAt: 'desc' },
            take: 1000,
        });
        const lastBySymbol = new Map<string, (typeof recentAuto)[number]>();
        for (const row of recentAuto) {
            if (!lastBySymbol.has(row.symbol)) lastBySymbol.set(row.symbol, row);
        }

        const opened: any[] = [];
        const closed: any[] = [];
        const skipped: Array<{ symbol: string; reason: string }> = [];

        const candidates = snapshot.filter((s) => {
            if (s.consensusDirection === 'NEUTRAL') return false;
            const directionalCount = s.consensusDirection === 'LONG' ? s.longCount : s.shortCount;
            if (directionalCount < rule.minTraders) return false;
            if (s.confidenceScore < rule.minConfidence) return false;
            if (Math.abs(s.sentimentScore) * 100 < rule.minSentimentAbs) return false;
            return true;
        });

        for (const c of candidates) {
            const direction = c.consensusDirection as 'LONG' | 'SHORT';
            const existing = openBySymbol.get(c.symbol);

            if (existing) {
                if (existing.direction === direction) {
                    skipped.push({ symbol: c.symbol, reason: 'already_open_same_direction' });
                    continue;
                }

                if (!options.dryRun) {
                    const exitPrice = (await getReferenceEntryPrice(existing.symbol)) || existing.entryPrice;
                    const perf = computeSimulationPerformance({
                        direction: existing.direction as 'LONG' | 'SHORT',
                        entryPrice: existing.entryPrice,
                        exitPrice,
                        leverage: existing.leverage,
                        marginNotional: existing.marginNotional,
                    });
                    const updated = await prisma.simulatedPosition.update({
                        where: { id: existing.id },
                        data: {
                            status: 'CLOSED',
                            exitPrice,
                            closedAt: new Date(),
                            closeReason: 'AUTO_REVERSE_SIGNAL',
                            closeTriggerLeadId: null,
                            closeTriggerEventType: null,
                            pnlUSDT: perf.pnlUSDT,
                            roiPct: perf.roiPct,
                            positionNotional: perf.positionNotional,
                        },
                    });
                    closed.push(updated);
                } else {
                    closed.push({ id: existing.id, symbol: existing.symbol, reason: 'AUTO_REVERSE_SIGNAL', dryRun: true });
                }
            }

            const last = lastBySymbol.get(c.symbol);
            if (last) {
                const elapsedMs = Date.now() - last.openedAt.getTime();
                const cooldownMs = Math.max(rule.cooldownMinutes, 0) * 60 * 1000;
                if (cooldownMs > 0 && elapsedMs < cooldownMs) {
                    skipped.push({ symbol: c.symbol, reason: 'cooldown_active' });
                    continue;
                }
            }

            const entryPrice = await getReferenceEntryPrice(c.symbol);
            if (!entryPrice) {
                skipped.push({ symbol: c.symbol, reason: 'no_reference_price' });
                continue;
            }

            const perfPreview = computeSimulationPerformance({
                direction,
                entryPrice,
                exitPrice: entryPrice,
                leverage: rule.leverage,
                marginNotional: rule.marginNotional,
            });

            if (!options.dryRun) {
                const created = await prisma.simulatedPosition.create({
                    data: {
                        platform: 'binance',
                        symbol: c.symbol,
                        direction,
                        status: 'OPEN',
                        leverage: rule.leverage,
                        marginNotional: rule.marginNotional,
                        positionNotional: perfPreview.positionNotional,
                        entryPrice,
                        source: 'AUTO',
                        notes: `auto-rule minTraders=${rule.minTraders} minConfidence=${rule.minConfidence}`,
                    },
                });
                opened.push(created);
                openBySymbol.set(c.symbol, created);
            } else {
                opened.push({
                    symbol: c.symbol,
                    direction,
                    entryPrice,
                    leverage: rule.leverage,
                    marginNotional: rule.marginNotional,
                    dryRun: true,
                });
            }
        }

        if (!options.dryRun) {
            await prisma.autoTriggerRule.update({
                where: { id: rule.id },
                data: { lastRunAt: new Date() },
            });
        }

        return {
            rule,
            reconciledCount: reconciled.length,
            openedCount: opened.length,
            closedCount: closed.length,
            skippedCount: skipped.length,
            opened,
            closed,
            skipped,
            candidates,
        };
    }

    async function runBacktestLite(params: {
        timeRange: string;
        segmentFilter: TraderSegmentFilter;
        minTraders: number;
        minConfidence: number;
        minSentimentAbs: number;
        leverage: number;
        marginNotional: number;
        // Sprint 2 params
        advancedMetrics?: boolean;
        monteCarlo?: boolean;
        walkForward?: boolean;
        equityCurve?: boolean;
        numSimulations?: number;
        persist?: boolean;
    }) {
        const timeRangeMs = getTimeRangeMs(params.timeRange);
        const startTime = timeRangeMs === Infinity
            ? new Date(0)
            : new Date(Date.now() - timeRangeMs);

        const events = await prisma.event.findMany({
            where: {
                platform: 'binance',
                eventType: { in: ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'] },
                OR: [
                    { eventTime: { gte: startTime } },
                    { eventTime: null, fetchedAt: { gte: startTime } },
                ],
            },
            orderBy: [{ eventTime: 'asc' }, { fetchedAt: 'asc' }],
            select: {
                leadId: true,
                symbol: true,
                eventType: true,
                eventTime: true,
                fetchedAt: true,
                price: true,
            },
        });

        const leadIds = Array.from(new Set(events.map((e) => e.leadId)));
        const [leadTraders, traderScores] = await Promise.all([
            prisma.leadTrader.findMany({
                where: { id: { in: leadIds } },
                select: { id: true, positionShow: true },
            }),
            prisma.traderScore.findMany({
                where: { leadId: { in: leadIds } },
                select: { leadId: true, traderWeight: true },
            }),
        ]);
        const segmentMap = new Map(leadTraders.map((t) => [t.id, resolveSegment(t.positionShow)]));
        const weightMap = new Map(traderScores.map((s) => [s.leadId, s.traderWeight ?? 0]));

        const filtered = events.filter((e) => {
            const segment = segmentMap.get(e.leadId) ?? 'UNKNOWN';
            return shouldIncludeSegment(segment, params.segmentFilter);
        });

        const bySymbol = new Map<string, {
            openLong: Set<string>;
            openShort: Set<string>;
            active: null | {
                direction: 'LONG' | 'SHORT';
                entryPrice: number;
                openedAt: Date;
                triggerCount: number;
                confidenceScore: number;
                sentimentScore: number;
            };
            lastPrice: number | null;
        }>();

        const trades: Array<{
            symbol: string;
            direction: 'LONG' | 'SHORT';
            openedAt: string;
            closedAt: string;
            entryPrice: number;
            exitPrice: number;
            pnlUSDT: number;
            roiPct: number;
            triggerCount: number;
            confidenceScore: number;
            sentimentScore: number;
            closeEventType: string;
            closeLeadId: string;
        }> = [];

        const sumWeights = (ids: Set<string>) => {
            let total = 0;
            for (const id of ids) total += weightMap.get(id) ?? 0;
            return total;
        };

        for (const ev of filtered) {
            const symbol = String(ev.symbol || '').toUpperCase();
            if (!symbol) continue;
            if (!bySymbol.has(symbol)) {
                bySymbol.set(symbol, {
                    openLong: new Set<string>(),
                    openShort: new Set<string>(),
                    active: null,
                    lastPrice: null,
                });
            }
            const state = bySymbol.get(symbol)!;
            const eventTime = ev.eventTime ?? ev.fetchedAt;
            const eventPrice = ev.price && ev.price > 0 ? ev.price : state.lastPrice;
            if (ev.price && ev.price > 0) state.lastPrice = ev.price;

            if (ev.eventType === 'OPEN_LONG') state.openLong.add(ev.leadId);
            if (ev.eventType === 'OPEN_SHORT') state.openShort.add(ev.leadId);
            if (ev.eventType === 'CLOSE_LONG') state.openLong.delete(ev.leadId);
            if (ev.eventType === 'CLOSE_SHORT') state.openShort.delete(ev.leadId);

            if (state.active) {
                const closeType = state.active.direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
                if (ev.eventType === closeType) {
                    const exitPrice = eventPrice && eventPrice > 0 ? eventPrice : state.active.entryPrice;
                    const perf = computeSimulationPerformance({
                        direction: state.active.direction,
                        entryPrice: state.active.entryPrice,
                        exitPrice,
                        leverage: params.leverage,
                        marginNotional: params.marginNotional,
                    });
                    trades.push({
                        symbol,
                        direction: state.active.direction,
                        openedAt: state.active.openedAt.toISOString(),
                        closedAt: eventTime.toISOString(),
                        entryPrice: round4(state.active.entryPrice),
                        exitPrice: round4(exitPrice),
                        pnlUSDT: perf.pnlUSDT,
                        roiPct: perf.roiPct,
                        triggerCount: state.active.triggerCount,
                        confidenceScore: state.active.confidenceScore,
                        sentimentScore: state.active.sentimentScore,
                        closeEventType: ev.eventType,
                        closeLeadId: ev.leadId,
                    });
                    state.active = null;
                }
                continue;
            }

            const longCount = state.openLong.size;
            const shortCount = state.openShort.size;
            const longWeight = sumWeights(state.openLong);
            const shortWeight = sumWeights(state.openShort);
            const sentimentScore = computeSentimentScore(longWeight, shortWeight);
            const confidenceScore = computeConfidenceScore(
                sentimentScore,
                longCount + shortCount,
                longWeight + shortWeight,
            );

            const direction: 'LONG' | 'SHORT' | null =
                longCount >= params.minTraders && shortCount >= params.minTraders
                    ? (longWeight >= shortWeight ? 'LONG' : 'SHORT')
                    : longCount >= params.minTraders
                        ? 'LONG'
                        : shortCount >= params.minTraders
                            ? 'SHORT'
                            : null;

            if (!direction) continue;
            if (confidenceScore < params.minConfidence) continue;
            if (Math.abs(sentimentScore) * 100 < params.minSentimentAbs) continue;
            if (!eventPrice || eventPrice <= 0) continue;

            state.active = {
                direction,
                entryPrice: eventPrice,
                openedAt: eventTime,
                triggerCount: direction === 'LONG' ? longCount : shortCount,
                confidenceScore,
                sentimentScore: round4(sentimentScore),
            };
        }

        const wins = trades.filter((t) => t.pnlUSDT > 0).length;
        const losses = trades.filter((t) => t.pnlUSDT < 0).length;
        const breakeven = trades.length - wins - losses;
        const totalPnl = round4(trades.reduce((sum, t) => sum + t.pnlUSDT, 0));
        const avgPnl = trades.length > 0 ? round4(totalPnl / trades.length) : 0;
        const avgRoiPct = trades.length > 0
            ? round4(trades.reduce((sum, t) => sum + t.roiPct, 0) / trades.length)
            : 0;
        const winRate = trades.length > 0 ? round4((wins / trades.length) * 100) : 0;

        const bySymbolPerf = new Map<string, { trades: number; pnl: number; wins: number }>();
        for (const t of trades) {
            const curr = bySymbolPerf.get(t.symbol) || { trades: 0, pnl: 0, wins: 0 };
            curr.trades += 1;
            curr.pnl += t.pnlUSDT;
            if (t.pnlUSDT > 0) curr.wins += 1;
            bySymbolPerf.set(t.symbol, curr);
        }
        const bySymbolRows = Array.from(bySymbolPerf.entries())
            .map(([symbol, row]) => ({
                symbol,
                trades: row.trades,
                totalPnl: round4(row.pnl),
                winRate: row.trades > 0 ? round4((row.wins / row.trades) * 100) : 0,
            }))
            .sort((a, b) => b.totalPnl - a.totalPnl);

        // Sprint 2: Build base result
        const result: any = {
            config: {
                ...params,
                startTime: startTime.toISOString(),
            },
            summary: {
                trades: trades.length,
                wins,
                losses,
                breakeven,
                winRate,
                totalPnl,
                avgPnl,
                avgRoiPct,
            },
            bySymbol: bySymbolRows,
            trades: trades.slice(-200).reverse(),
        };

        // Sprint 2: Advanced analytics (optional)
        const INITIAL_BALANCE = 10000; // Default initial balance for backtest

        if (params.advancedMetrics && trades.length > 0) {
            const tradeResults = trades.map((t) => ({
                pnl: t.pnlUSDT,
                roi: t.roiPct / 100,
                timestamp: new Date(t.closedAt),
            }));

            result.advancedMetrics = computeAdvancedMetrics({
                trades: tradeResults,
                initialBalance: INITIAL_BALANCE,
            });
        }

        if (params.monteCarlo && trades.length > 0) {
            result.monteCarlo = runMonteCarloSimulation({
                trades: trades.map((t) => ({ pnl: t.pnlUSDT, roi: t.roiPct / 100 })),
                initialBalance: INITIAL_BALANCE,
                numSimulations: params.numSimulations || 1000,
            });
        }

        if (params.walkForward && trades.length >= 50) {
            try {
                result.walkForward = runWalkForwardAnalysis({
                    trades: trades.map((t) => ({
                        pnl: t.pnlUSDT,
                        roi: t.roiPct / 100,
                        timestamp: new Date(t.closedAt),
                    })),
                    inSampleRatio: 0.7,
                    numWindows: 5,
                });
            } catch (error) {
                result.walkForwardError = error instanceof Error ? error.message : 'Walk-forward analysis failed';
            }
        }

        if (params.equityCurve && trades.length > 0) {
            result.equityCurve = generateEquityCurve({
                trades: trades.map((t) => ({
                    pnl: t.pnlUSDT,
                    timestamp: new Date(t.closedAt),
                })),
                initialBalance: INITIAL_BALANCE,
            });
        }

        // Sprint 2: Persist to BacktestResult table
        if (params.persist && params.advancedMetrics && result.advancedMetrics) {
            try {
                await prisma.backtestResult.create({
                    data: {
                        symbolFilter: null,
                        dateRange: `${params.timeRange}_${startTime.toISOString()}`,
                        totalTrades: trades.length,
                        winRate: winRate / 100,
                        avgWin: wins > 0 ? trades.filter((t) => t.pnlUSDT > 0).reduce((sum, t) => sum + t.pnlUSDT, 0) / wins : 0,
                        avgLoss: losses > 0 ? Math.abs(trades.filter((t) => t.pnlUSDT < 0).reduce((sum, t) => sum + t.pnlUSDT, 0) / losses) : 0,
                        profitFactor: result.advancedMetrics.profitFactor,
                        netPnl: totalPnl,
                        maxDrawdown: result.advancedMetrics.maxDrawdown,
                        sharpeRatio: result.advancedMetrics.sharpeRatio,
                        sortinoRatio: result.advancedMetrics.sortinoRatio,
                        calmarRatio: result.advancedMetrics.calmarRatio,
                        var95: result.advancedMetrics.var95,
                        cvar95: result.advancedMetrics.cvar95,
                        mcMean: result.monteCarlo?.mean,
                        mcMedian: result.monteCarlo?.median,
                        mcStdDev: result.monteCarlo?.stdDev,
                        mcConfidence95Low: result.monteCarlo?.confidence95Low,
                        mcConfidence95High: result.monteCarlo?.confidence95High,
                        probabilityOfRuin: result.monteCarlo?.probabilityOfRuin,
                        wfInSampleWinRate: result.walkForward?.avgInSampleWinRate,
                        wfOutSampleWinRate: result.walkForward?.avgOutSampleWinRate,
                        wfCorrelation: result.walkForward?.correlation,
                        wfOverfitScore: result.walkForward?.overfitScore,
                    },
                });
            } catch (error) {
                result.persistError = error instanceof Error ? error.message : 'Failed to persist backtest result';
            }
        }

        return result;
    }

    async function runPhase6Insights(params: {
        timeRange: string;
        segmentFilter: TraderSegmentFilter;
        top: number;
        mode: InsightsMode;
        preset: InsightsPresetConfig;
    }) {
        const preset = params.preset;

        const timeRangeMs = getTimeRangeMs(params.timeRange);
        const startTime = timeRangeMs === Infinity
            ? new Date(0)
            : new Date(Date.now() - timeRangeMs);

        const [consensusSnapshot, rawEvents, snapshotRows, leadRows] = await Promise.all([
            computeLiveConsensusSnapshot({
                timeRange: params.timeRange,
                segmentFilter: params.segmentFilter,
            }),
            prisma.event.findMany({
                where: {
                    platform: 'binance',
                    eventType: { in: ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'] },
                    OR: [
                        { eventTime: { gte: startTime } },
                        { eventTime: null, fetchedAt: { gte: startTime } },
                    ],
                },
                orderBy: [{ eventTime: 'asc' }, { fetchedAt: 'asc' }],
                select: {
                    leadId: true,
                    symbol: true,
                    eventType: true,
                    eventTime: true,
                    fetchedAt: true,
                    realizedPnl: true,
                },
            }),
            prisma.positionSnapshot.findMany({
                where: {
                    platform: 'binance',
                    fetchedAt: { gte: startTime },
                },
                select: {
                    leadId: true,
                    symbol: true,
                    leverage: true,
                },
            }),
            prisma.leadTrader.findMany({
                where: { platform: 'binance' },
                include: {
                    traderScore: {
                        select: {
                            traderWeight: true,
                            qualityScore: true,
                            confidence: true,
                            winRate: true,
                        },
                    },
                },
            }),
        ]);

        const segmentByLead = new Map(leadRows.map((t) => [t.id, resolveSegment(t.positionShow)]));
        const weightByLead = new Map(
            leadRows.map((t) => [t.id, t.traderScore?.traderWeight ?? 0]),
        );

        const filteredEvents = rawEvents.filter((ev) => {
            const segment = segmentByLead.get(ev.leadId) ?? 'UNKNOWN';
            return shouldIncludeSegment(segment, params.segmentFilter);
        });
        const filteredSnapshots = snapshotRows.filter((row) => {
            const segment = segmentByLead.get(row.leadId) ?? 'UNKNOWN';
            return shouldIncludeSegment(segment, params.segmentFilter);
        });

        const sumWeights = (ids: Set<string>) => {
            let total = 0;
            for (const id of ids) total += weightByLead.get(id) ?? 0;
            return total;
        };

        // Stability computation by replaying OPEN/CLOSE event stream per symbol.
        const symbolState = new Map<string, {
            openLong: Set<string>;
            openShort: Set<string>;
            updates: number;
            flips: number;
            lastDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
            lastNonNeutral: 'LONG' | 'SHORT' | null;
        }>();

        const activityByLead = new Map<string, number>();
        const realizedByLead = new Map<string, number>();

        for (const ev of filteredEvents) {
            const symbol = String(ev.symbol || '').toUpperCase();
            if (!symbol) continue;
            if (!symbolState.has(symbol)) {
                symbolState.set(symbol, {
                    openLong: new Set<string>(),
                    openShort: new Set<string>(),
                    updates: 0,
                    flips: 0,
                    lastDirection: 'NEUTRAL',
                    lastNonNeutral: null,
                });
            }
            const state = symbolState.get(symbol)!;

            if (ev.eventType === 'OPEN_LONG') state.openLong.add(ev.leadId);
            if (ev.eventType === 'CLOSE_LONG') state.openLong.delete(ev.leadId);
            if (ev.eventType === 'OPEN_SHORT') state.openShort.add(ev.leadId);
            if (ev.eventType === 'CLOSE_SHORT') state.openShort.delete(ev.leadId);

            const longWeight = sumWeights(state.openLong);
            const shortWeight = sumWeights(state.openShort);
            const direction = getConsensusDirection(computeSentimentScore(longWeight, shortWeight));

            state.updates += 1;
            if (direction !== 'NEUTRAL') {
                if (state.lastNonNeutral && state.lastNonNeutral !== direction) {
                    state.flips += 1;
                }
                state.lastNonNeutral = direction;
            }
            state.lastDirection = direction;

            activityByLead.set(ev.leadId, (activityByLead.get(ev.leadId) ?? 0) + 1);
            const realized = Number(ev.realizedPnl ?? 0);
            if (Number.isFinite(realized) && realized !== 0) {
                realizedByLead.set(ev.leadId, round4((realizedByLead.get(ev.leadId) ?? 0) + realized));
            }
        }

        const stability = Array.from(symbolState.entries())
            .map(([symbol, s]) => {
                const flipRate = s.updates > 1 ? s.flips / (s.updates - 1) : 0;
                const stabilityScore = Math.max(0, Math.round((1 - Math.min(1, flipRate * 1.5)) * 100));
                return {
                    symbol,
                    updates: s.updates,
                    flips: s.flips,
                    flipRate: round4(flipRate),
                    stabilityScore,
                    lastDirection: s.lastDirection,
                };
            })
            .sort((a, b) => a.stabilityScore - b.stabilityScore || b.flips - a.flips);

        const leverageBySymbol = new Map<string, { count: number; leverageSum: number; maxLeverage: number }>();
        const leverageByLead = new Map<string, { count: number; leverageSum: number; maxLeverage: number }>();
        for (const row of filteredSnapshots) {
            const symbol = String(row.symbol || '').toUpperCase();
            const lev = Number(row.leverage ?? 0);
            if (!symbol || !Number.isFinite(lev) || lev <= 0) continue;

            const symbolAgg = leverageBySymbol.get(symbol) || { count: 0, leverageSum: 0, maxLeverage: 0 };
            symbolAgg.count += 1;
            symbolAgg.leverageSum += lev;
            symbolAgg.maxLeverage = Math.max(symbolAgg.maxLeverage, lev);
            leverageBySymbol.set(symbol, symbolAgg);

            const leadAgg = leverageByLead.get(row.leadId) || { count: 0, leverageSum: 0, maxLeverage: 0 };
            leadAgg.count += 1;
            leadAgg.leverageSum += lev;
            leadAgg.maxLeverage = Math.max(leadAgg.maxLeverage, lev);
            leverageByLead.set(row.leadId, leadAgg);
        }

        interface InsightAnomaly {
            type: string;
            severity: InsightAnomalySeverity;
            symbol: string;
            message: string;
            metric: string;
            value: number;
        }

        const anomalyMap = new Map<string, InsightAnomaly>();
        const upsertAnomaly = (item: InsightAnomaly) => {
            const key = `${item.type}:${item.symbol}`;
            const existing = anomalyMap.get(key);
            if (!existing || getAnomalySeverityRank(item.severity) > getAnomalySeverityRank(existing.severity)) {
                anomalyMap.set(key, item);
            }
        };

        for (const row of consensusSnapshot) {
            const sentimentAbsPct = Math.abs(row.sentimentScore) * 100;
            if (
                row.totalTraders >= preset.crowdedMinTraders
                && row.confidenceScore >= preset.crowdedMinConfidence
                && sentimentAbsPct >= preset.crowdedMinSentimentAbs
            ) {
                upsertAnomaly({
                    type: 'CROWDED_CONSENSUS',
                    severity: 'HIGH',
                    symbol: row.symbol,
                    message: `${row.symbol} çok kalabalık tek yönlü konsensus`,
                    metric: 'confidenceScore',
                    value: row.confidenceScore,
                });
            } else if (
                row.totalTraders >= preset.crowdedMinTraders
                && row.confidenceScore < preset.lowConfidenceLimit
            ) {
                upsertAnomaly({
                    type: 'FRAGILE_CONSENSUS',
                    severity: 'MEDIUM',
                    symbol: row.symbol,
                    message: `${row.symbol} düşük güvenli kırılgan konsensus`,
                    metric: 'confidenceScore',
                    value: row.confidenceScore,
                });
            }
        }

        for (const [symbol, lev] of leverageBySymbol.entries()) {
            const avgLev = lev.count > 0 ? lev.leverageSum / lev.count : 0;
            if (avgLev >= preset.extremeLeverageThreshold) {
                upsertAnomaly({
                    type: 'EXTREME_LEVERAGE',
                    severity: 'HIGH',
                    symbol,
                    message: `${symbol} aşırı yüksek kaldıraç kullanımı`,
                    metric: 'avgLeverage',
                    value: round4(avgLev),
                });
            } else if (avgLev >= preset.highLeverageThreshold) {
                upsertAnomaly({
                    type: 'HIGH_LEVERAGE',
                    severity: 'MEDIUM',
                    symbol,
                    message: `${symbol} yüksek kaldıraç bölgesinde`,
                    metric: 'avgLeverage',
                    value: round4(avgLev),
                });
            }
        }

        for (const row of stability) {
            if (row.flips >= preset.unstableHighFlips && row.updates >= preset.unstableMinUpdates) {
                upsertAnomaly({
                    type: 'DIRECTION_FLIP_CLUSTER',
                    severity: 'HIGH',
                    symbol: row.symbol,
                    message: `${row.symbol} yön değişimi kümesi (flip cluster)`,
                    metric: 'flips',
                    value: row.flips,
                });
            } else if (row.flips >= preset.unstableMinFlips && row.updates >= preset.unstableMinUpdates) {
                upsertAnomaly({
                    type: 'UNSTABLE_DIRECTION',
                    severity: 'MEDIUM',
                    symbol: row.symbol,
                    message: `${row.symbol} yön istikrarı düşük`,
                    metric: 'stabilityScore',
                    value: row.stabilityScore,
                });
            }
        }

        const anomalies = Array.from(anomalyMap.values())
            .sort((a, b) =>
                getAnomalySeverityRank(b.severity) - getAnomalySeverityRank(a.severity)
                || b.value - a.value,
            )
            .slice(0, 30);

        const crowdedSymbols = consensusSnapshot.filter(
            (row) =>
                row.totalTraders >= preset.crowdedMinTraders
                && row.confidenceScore >= preset.crowdedMinConfidence
                && Math.abs(row.sentimentScore) * 100 >= preset.crowdedMinSentimentAbs,
        ).length;
        const highLeverageSymbols = Array.from(leverageBySymbol.values()).filter(
            (row) => row.count > 0 && (row.leverageSum / row.count) >= preset.highLeverageThreshold,
        ).length;
        const unstableSymbols = stability.filter(
            (row) => row.flips >= preset.unstableMinFlips && row.updates >= preset.unstableMinUpdates,
        ).length;
        const lowConfidenceSymbols = consensusSnapshot.filter(
            (row) => row.totalTraders >= preset.crowdedMinTraders && row.confidenceScore < preset.lowConfidenceLimit,
        ).length;
        const anomalyPressure = anomalies.filter((a) => a.severity === 'HIGH').length;
        const riskScore = Math.min(
            100,
            round4((
                crowdedSymbols * 18 +
                highLeverageSymbols * 16 +
                unstableSymbols * 14 +
                lowConfidenceSymbols * 10 +
                anomalyPressure * 6
            ) * preset.scoreMultiplier),
        );
        const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
            riskScore >= 70 ? 'HIGH' :
                riskScore >= 40 ? 'MEDIUM' : 'LOW';

        const leaderboard = leadRows
            .filter((lead) => shouldIncludeSegment(resolveSegment(lead.positionShow), params.segmentFilter))
            .map((lead) => {
                const traderWeight = lead.traderScore?.traderWeight ?? 0;
                const qualityNorm = Math.max(0, Math.min(1, (lead.traderScore?.qualityScore ?? 0) / 100));
                const winRateNorm = Math.max(0, Math.min(1, lead.traderScore?.winRate ?? 0.5));
                const activityEvents = activityByLead.get(lead.id) ?? 0;
                const activityNorm = Math.min(1, activityEvents / 30);
                const levAgg = leverageByLead.get(lead.id);
                const avgLeverage = levAgg && levAgg.count > 0
                    ? round4(levAgg.leverageSum / levAgg.count)
                    : 0;
                const realizedPnl = round4(realizedByLead.get(lead.id) ?? 0);

                const leveragePenalty =
                    avgLeverage >= 75 ? 0.15 :
                        avgLeverage >= 45 ? 0.08 :
                            avgLeverage >= 25 ? 0.04 : 0;
                const rawScore = 100 * (
                    0.45 * traderWeight +
                    0.30 * qualityNorm +
                    0.15 * winRateNorm +
                    0.10 * activityNorm
                );
                const score = round4(Math.max(0, rawScore * (1 - leveragePenalty)));

                return {
                    leadId: lead.id,
                    nickname: lead.nickname || `Trader ${lead.id.slice(-6)}`,
                    segment: resolveSegment(lead.positionShow),
                    traderWeight: round4(traderWeight),
                    qualityScore: lead.traderScore?.qualityScore ?? null,
                    confidence: (lead.traderScore?.confidence as 'low' | 'medium' | 'high' | null) ?? null,
                    winRate: lead.traderScore?.winRate ?? null,
                    activityEvents,
                    avgLeverage,
                    realizedPnl,
                    score,
                };
            })
            .sort((a, b) => b.score - a.score || b.activityEvents - a.activityEvents)
            .slice(0, params.top)
            .map((row, idx) => ({
                rank: idx + 1,
                ...row,
            }));

        return {
            generatedAt: new Date().toISOString(),
            filters: {
                timeRange: params.timeRange,
                segment: params.segmentFilter,
                top: params.top,
                mode: params.mode,
            },
            riskOverview: {
                score: round4(riskScore),
                level: riskLevel,
                crowdedSymbols,
                highLeverageSymbols,
                unstableSymbols,
                lowConfidenceSymbols,
            },
            anomalies,
            stability: stability.slice(0, 30),
            leaderboard,
        };
    }

    // GET /signals/heatmap - Aggregated position data across all traders (FAZ 1: weighted consensus)
    fastify.get('/signals/heatmap', async (
        request: FastifyRequest<{ Querystring: HeatmapQuery }>,
        reply: FastifyReply
    ) => {
        const {
            timeRange = '24h',
            side = 'ALL',
            minTraders = '1',
            leverage = 'ALL',
            segment = 'BOTH',
            recentlyOpened, // YOL 2: filter to recently opened positions
        } = request.query;

        const minTradersNum = parseInt(minTraders) || 1;
        const timeRangeMs = getTimeRangeMs(timeRange);
        const segmentFilter = parseSegmentFilter(segment);
        const cutoffTime = timeRangeMs === Infinity
            ? new Date(0)
            : new Date(Date.now() - timeRangeMs);
        // const cutoffMs = cutoffTime.getTime(); // Unused for now

        // YOL 2: Parse recentlyOpened filter
        const recentlyOpenedMs = recentlyOpened ? parseRecentlyOpenedMs(recentlyOpened) : null;
        const recentlyOpenedCutoff = recentlyOpenedMs
            ? new Date(Date.now() - recentlyOpenedMs)
            : null;

        // Get latest ingests for each trader
        const latestIngests = await prisma.$queryRaw<Array<{ id: string; leadId: string; payload: any }>>`
      SELECT DISTINCT ON ("leadId") id, "leadId", payload
      FROM "RawIngest"
      WHERE "fetchedAt" >= ${cutoffTime}
      ORDER BY "leadId", "fetchedAt" DESC
    `;

        // FAZ 1: Batch-fetch trader weights + segment + YOL 2: position states
        const leadIds = latestIngests.map(i => i.leadId);
        const [leadTraders, traderScores, positionStates] = await Promise.all([
            prisma.leadTrader.findMany({
                where: { id: { in: leadIds } },
                select: { id: true, positionShow: true, nickname: true },
            }),
            prisma.traderScore.findMany({
                where: { leadId: { in: leadIds } },
                select: {
                    leadId: true,
                    traderWeight: true,
                    qualityScore: true,
                    confidence: true,
                    winRate: true,
                },
            }),
            // YOL 2: Get active position states for open times (sorted newest first)
            prisma.positionState.findMany({
                where: {
                    leadId: { in: leadIds },
                    status: 'ACTIVE',
                },
                select: {
                    leadId: true,
                    symbol: true,
                    direction: true,
                    firstSeenAt: true,
                    estimatedOpenTime: true,
                    entryPrice: true,
                },
                orderBy: {
                    // Sort by estimatedOpenTime if available, otherwise firstSeenAt (newest first)
                    estimatedOpenTime: 'desc',
                },
            }),
        ]);
        const ltMap = new Map(leadTraders.map(t => [t.id, t]));
        const scoreMap = new Map(traderScores.map(s => [s.leadId, s]));

        // Estimate leverages for HIDDEN traders
        const hiddenTraderIds = leadTraders
            .filter(t => t.positionShow === false)
            .map(t => t.id);
        const leverageEstimates = hiddenTraderIds.length > 0
            ? await batchEstimateLeverages(hiddenTraderIds)
            : new Map();

        // YOL 2: Create position state lookup map
        const posStateMap = new Map<string, typeof positionStates[0]>();
        for (const ps of positionStates) {
            const key = `${ps.leadId}|${ps.symbol}|${ps.direction}`;
            posStateMap.set(key, ps);
        }

        // Aggregate positions by symbol
        const symbolMap = new Map<string, AggregatedPosition>();

        for (const ingest of latestIngests) {
            if (!ingest.payload) continue;

            const payload = ingest.payload;
            const portfolio = payload.portfolioDetail || {};
            const positions = payload.activePositions || [];
            // const orders = payload.orderHistory?.allOrders || []; // Unused for now
            const lt = ltMap.get(ingest.leadId);
            const score = scoreMap.get(ingest.leadId);
            const weight = score?.traderWeight ?? null;
            const positionShow = lt?.positionShow ?? null;
            const traderSegment = resolveSegment(positionShow);
            if (!shouldIncludeSegment(traderSegment, segmentFilter)) continue;

            const nickname = portfolio.nickname || lt?.nickname || `Trader ${ingest.leadId.slice(-6)}`;
            const avatarUrl = portfolio.avatarUrl || '';

            if (traderSegment !== 'HIDDEN') {
                for (const pos of positions) {
                    const posLeverage = pos.leverage || 0;
                    const normalizedSide = normalizePositionSide(pos.positionSide, pos.positionAmount);
                    if (!normalizedSide) continue;
                    if (!filterByLeverage(posLeverage, leverage)) continue;
                    if (side !== 'ALL' && normalizedSide !== side) continue;

                    const symbol = String(pos.symbol || '').toUpperCase();
                    if (!symbol) continue;

                    if (!symbolMap.has(symbol)) {
                        symbolMap.set(symbol, {
                            symbol,
                            longCount: 0,
                            shortCount: 0,
                            totalTraders: 0,
                            avgLeverage: 0,
                            totalVolume: 0,
                            longVolume: 0,
                            shortVolume: 0,
                            derivedConfidenceSum: 0,
                            derivedTraderCount: 0,
                            visibleTraderCount: 0,
                            hiddenTraderCount: 0,
                            traders: [],
                        });
                    }

                    const agg = symbolMap.get(symbol)!;
                    const positionSide = normalizedSide;
                    const notionalValue = Math.abs(parseFloat(pos.notionalValue || '0'));
                    const unrealizedPnl = parseFloat(pos.unrealizedProfit || '0');
                    const entryPrice = parseFloat(pos.entryPrice || '0');
                    const positionAmount = Math.abs(parseFloat(pos.positionAmount || '0'));

                    if (positionSide === 'LONG') {
                        agg.longCount++;
                        agg.longVolume += notionalValue;
                    } else {
                        agg.shortCount++;
                        agg.shortVolume += notionalValue;
                    }

                    agg.totalVolume += notionalValue;
                    agg.avgLeverage = (agg.avgLeverage * agg.totalTraders + posLeverage) / (agg.totalTraders + 1);
                    agg.totalTraders++;
                    agg.visibleTraderCount++;

                    // YOL 2: Get position state for opening time
                    const posKey = `${ingest.leadId}|${symbol}|${positionSide}`;
                    const posState = posStateMap.get(posKey);
                    // Use configured strategy: estimatedOpenTime (midpoint) or firstSeenAt (conservative)
                    const openedAt = config.positioning.useEstimatedOpenTime
                        ? (posState?.estimatedOpenTime || posState?.firstSeenAt || null)
                        : (posState?.firstSeenAt || null);
                    const holdDurationSeconds = openedAt
                        ? Math.floor((Date.now() - openedAt.getTime()) / 1000)
                        : null;

                    // YOL 2: Filter by recentlyOpened if specified
                    if (recentlyOpenedCutoff && openedAt) {
                        if (openedAt < recentlyOpenedCutoff) {
                            // Position opened too long ago - skip it
                            continue;
                        }
                    } else if (recentlyOpenedCutoff && !openedAt) {
                        // No opening time data - skip if recentlyOpened filter is active
                        continue;
                    }

                    // Calculate ROE (Return on Equity) based on margin
                    const marginUsed = notionalValue / posLeverage;
                    const roe = marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0;

                    agg.traders.push({
                        leadId: ingest.leadId,
                        nickname,
                        avatarUrl,
                        side: positionSide,
                        leverage: posLeverage,
                        entryPrice,
                        markPrice: parseFloat(pos.markPrice || '0'),
                        size: positionAmount,
                        pnl: unrealizedPnl,
                        pnlPercent: entryPrice > 0 ? (unrealizedPnl / (positionAmount * entryPrice)) * 100 : 0,
                        roe: Math.round(roe * 100) / 100,
                        traderWeight: weight,
                        segment: traderSegment,
                        qualityScore: score?.qualityScore ?? null,
                        confidence: (score?.confidence as 'low' | 'medium' | 'high' | null) ?? null,
                        winRate: score?.winRate ?? null,
                        isDerived: false,
                        derivedConfidence: null,
                        lastAction: null,
                        // YOL 2: Position timing data
                        openedAt: openedAt?.toISOString() ?? null,
                        holdDurationSeconds,
                    });
                }
                continue;
            }

            // FAZ 1: Hidden trader - get positions from PositionState table (sorted newest first)
            const hiddenPositions = await prisma.positionState.findMany({
                where: {
                    platform: 'binance',
                    leadId: ingest.leadId,
                    status: 'ACTIVE',
                    firstSeenAt: timeRangeMs === Infinity ? undefined : { gte: cutoffTime },
                },
                orderBy: {
                    // Sort by estimatedOpenTime if available, otherwise firstSeenAt (newest first)
                    estimatedOpenTime: 'desc',
                },
            });

            for (const hiddenPos of hiddenPositions) {
                const normalizedSide = hiddenPos.direction as 'LONG' | 'SHORT';
                if (!normalizedSide) continue;
                if (side !== 'ALL' && normalizedSide !== side) continue;

                const symbol = hiddenPos.symbol;
                if (!symbolMap.has(symbol)) {
                    symbolMap.set(symbol, {
                        symbol,
                        longCount: 0,
                        shortCount: 0,
                        totalTraders: 0,
                        avgLeverage: 0,
                        totalVolume: 0,
                        longVolume: 0,
                        shortVolume: 0,
                        derivedConfidenceSum: 0,
                        derivedTraderCount: 0,
                        visibleTraderCount: 0,
                        hiddenTraderCount: 0,
                        traders: [],
                    });
                }

                const agg = symbolMap.get(symbol)!;

                // Estimate notional (if we don't have it, use entryPrice * amount)
                const notional = hiddenPos.entryPrice * hiddenPos.amount;

                if (normalizedSide === 'LONG') {
                    agg.longCount++;
                    agg.longVolume += notional;
                } else {
                    agg.shortCount++;
                    agg.shortVolume += notional;
                }

                agg.totalVolume += notional;
                agg.totalTraders++;
                agg.hiddenTraderCount++;
                agg.derivedTraderCount++;

                // FAZ 1: Calculate confidence based on data source
                const confidence = hiddenPos.openEventId ? 0.85 : 0.70; // Higher if linked to Event
                agg.derivedConfidenceSum += confidence;

                // FAZ 2: Get timing data from PositionState (using configured strategy)
                const openedAt = config.positioning.useEstimatedOpenTime
                    ? (hiddenPos.estimatedOpenTime || hiddenPos.firstSeenAt)
                    : hiddenPos.firstSeenAt;
                const holdDurationSeconds = openedAt
                    ? Math.floor((Date.now() - openedAt.getTime()) / 1000)
                    : null;

                // YOL 2: Filter by recentlyOpened if specified
                if (recentlyOpenedCutoff && openedAt) {
                    if (openedAt < recentlyOpenedCutoff) {
                        continue; // Skip - opened too long ago
                    }
                } else if (recentlyOpenedCutoff && !openedAt) {
                    continue; // Skip - no timing data
                }

                // Use estimated leverage for HIDDEN traders
                const leverageEstimate = leverageEstimates.get(ingest.leadId);
                const estimatedLeverage = hiddenPos.leverage ?? leverageEstimate?.estimatedLeverage ?? null;

                agg.traders.push({
                    leadId: ingest.leadId,
                    nickname,
                    avatarUrl,
                    side: normalizedSide,
                    leverage: estimatedLeverage ?? 0, // Estimated leverage for hidden traders
                    entryPrice: hiddenPos.entryPrice,
                    markPrice: hiddenPos.entryPrice, // No current price for HIDDEN
                    size: hiddenPos.amount,
                    pnl: 0, // Can't calculate without current price
                    pnlPercent: 0,
                    roe: 0,
                    traderWeight: weight,
                    segment: traderSegment,
                    qualityScore: score?.qualityScore ?? null,
                    confidence: (score?.confidence as 'low' | 'medium' | 'high' | null) ?? null,
                    winRate: score?.winRate ?? null,
                    isDerived: true,
                    derivedConfidence: Math.round(confidence * 10000) / 10000,
                    lastAction: null,
                    // FAZ 2: Timing data from PositionState
                    openedAt: openedAt?.toISOString() ?? null,
                    holdDurationSeconds,
                });
            }
        }

        // Filter by minTraders, compute consensus, convert to array
        const results = Array.from(symbolMap.values())
            .filter(agg => agg.totalTraders >= minTradersNum)
            .map(agg => {
                // FAZ 1: Weighted consensus computation
                let longWeight = 0;
                let shortWeight = 0;
                let weightedLevSum = 0;
                let weightSum = 0;

                // YOL 2: Aggregate P&L and timing stats
                let totalUnrealizedPnl = 0;
                let totalRoe = 0;
                let holdDurations: number[] = [];

                // YOL 2: Trader success comparison (LONG vs SHORT)
                let longQualitySum = 0;
                let longWinRateSum = 0;
                let longWeightSum = 0;
                let longTraderCount = 0;
                let shortQualitySum = 0;
                let shortWinRateSum = 0;
                let shortWeightSum = 0;
                let shortTraderCount = 0;

                for (const t of agg.traders) {
                    const w = t.traderWeight ?? 0;
                    if (t.side === 'LONG') {
                        longWeight += w;
                        longWeightSum += w;
                        longTraderCount++;
                        if (t.qualityScore != null) longQualitySum += t.qualityScore;
                        if (t.winRate != null) longWinRateSum += t.winRate;
                    } else {
                        shortWeight += w;
                        shortWeightSum += w;
                        shortTraderCount++;
                        if (t.qualityScore != null) shortQualitySum += t.qualityScore;
                        if (t.winRate != null) shortWinRateSum += t.winRate;
                    }
                    weightedLevSum += t.leverage * w;
                    weightSum += w;

                    // YOL 2: Aggregate P&L and timing
                    if (t.pnl != null) totalUnrealizedPnl += t.pnl;
                    if (t.roe != null) totalRoe += t.roe;
                    if (t.holdDurationSeconds != null) holdDurations.push(t.holdDurationSeconds);
                }

                const sentimentScore = computeSentimentScore(longWeight, shortWeight);
                const sumWeights = Math.round((longWeight + shortWeight) * 10000) / 10000;
                const confidenceScore = computeConfidenceScore(sentimentScore, agg.totalTraders, sumWeights);
                const consensusDirection = getConsensusDirection(sentimentScore);
                const weightedAvgLeverage = weightSum > 0
                    ? Math.round((weightedLevSum / weightSum) * 10) / 10
                    : Math.round(agg.avgLeverage * 10) / 10;

                // YOL 2: Calculate averages
                const avgHoldDurationSeconds = holdDurations.length > 0
                    ? Math.floor(holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length)
                    : null;
                const avgRoe = agg.totalTraders > 0
                    ? Math.round((totalRoe / agg.totalTraders) * 100) / 100
                    : 0;

                // YOL 2: LONG vs SHORT trader success comparison
                const longAvgQuality = longTraderCount > 0 ? Math.round(longQualitySum / longTraderCount) : null;
                const shortAvgQuality = shortTraderCount > 0 ? Math.round(shortQualitySum / shortTraderCount) : null;
                const longAvgWinRate = longTraderCount > 0 ? Math.round((longWinRateSum / longTraderCount) * 10000) / 10000 : null;
                const shortAvgWinRate = shortTraderCount > 0 ? Math.round((shortWinRateSum / shortTraderCount) * 10000) / 10000 : null;
                const longAvgWeight = longTraderCount > 0 ? Math.round((longWeightSum / longTraderCount) * 10000) / 10000 : null;
                const shortAvgWeight = shortTraderCount > 0 ? Math.round((shortWeightSum / shortTraderCount) * 10000) / 10000 : null;

                // Determine which side has stronger traders
                let strongerSide: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
                if (longAvgQuality != null && shortAvgQuality != null) {
                    if (longAvgQuality > shortAvgQuality + 10) strongerSide = 'LONG';
                    else if (shortAvgQuality > longAvgQuality + 10) strongerSide = 'SHORT';
                } else if (longAvgWeight != null && shortAvgWeight != null) {
                    if (longAvgWeight > shortAvgWeight + 0.1) strongerSide = 'LONG';
                    else if (shortAvgWeight > longAvgWeight + 0.1) strongerSide = 'SHORT';
                }

                // topTraders sorted by weight desc
                const topTraders = agg.traders
                    .sort((a, b) => (b.traderWeight ?? 0) - (a.traderWeight ?? 0))
                    .map(t => ({
                        leadId: t.leadId,
                        nickname: t.nickname,
                        side: t.side,
                        leverage: t.leverage,
                        traderWeight: t.traderWeight,
                        entryPrice: t.entryPrice,
                        markPrice: t.markPrice ?? null,
                        isDerived: t.isDerived ?? false,
                        derivedConfidence: t.derivedConfidence ?? null,
                        // YOL 2: P&L and timing details
                        pnl: t.pnl ?? null,
                        pnlPercent: t.pnlPercent ?? null,
                        roe: t.roe ?? null,
                        openedAt: t.openedAt ?? null,
                        holdDurationSeconds: t.holdDurationSeconds ?? null,
                        holdDurationFormatted: t.holdDurationSeconds
                            ? formatDuration(t.holdDurationSeconds)
                            : null,
                    }));

                const derivedConfidenceAvg = agg.derivedTraderCount > 0
                    ? Math.round((agg.derivedConfidenceSum / agg.derivedTraderCount) * 100)
                    : null;
                const dataSource =
                    agg.derivedTraderCount > 0 && agg.visibleTraderCount > 0
                        ? 'MIXED'
                        : agg.derivedTraderCount > 0
                            ? 'HIDDEN_DERIVED'
                            : 'VISIBLE';

                // NEW: Calculate consensusAge (time since earliest position opened)
                const openTimes = agg.traders
                    .map(t => {
                        if (!t.openedAt) return null;
                        // openedAt might be Date object or ISO string
                        try {
                            const time = typeof t.openedAt === 'string'
                                ? new Date(t.openedAt).getTime()
                                : (t.openedAt as Date).getTime();
                            return isNaN(time) ? null : time;
                        } catch {
                            return null;
                        }
                    })
                    .filter((t): t is number => t != null);
                const earliestOpenTime = openTimes.length > 0 ? Math.min(...openTimes) : null;
                const consensusAge = earliestOpenTime ? Date.now() - earliestOpenTime : null;

                // NEW: Calculate entryPriceSpread (coefficient of variation)
                const entryPrices = agg.traders
                    .filter(t => t.entryPrice > 0)
                    .map(t => t.entryPrice);
                let entryPriceSpread = 0;
                if (entryPrices.length > 1) {
                    const avgPrice = entryPrices.reduce((a, b) => a + b, 0) / entryPrices.length;
                    const variance = entryPrices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / entryPrices.length;
                    const stdDev = Math.sqrt(variance);
                    entryPriceSpread = avgPrice > 0 ? (stdDev / avgPrice) * 100 : 0; // Coefficient of variation as %
                }

                // NEW: Calculate recommendedPositionSize (% of portfolio based on confidence)
                let recommendedPositionSize = 0;
                if (confidenceScore >= 85) recommendedPositionSize = 0.03; // 3% for very high confidence
                else if (confidenceScore >= 75) recommendedPositionSize = 0.02; // 2% for high confidence
                else if (confidenceScore >= 65) recommendedPositionSize = 0.01; // 1% for moderate confidence
                else if (confidenceScore >= 55) recommendedPositionSize = 0.005; // 0.5% for low confidence

                // NEW: Calculate consensusMomentum (FORMING, STABLE, WEAKENING)
                const now = Date.now();
                const oneHourAgo = now - 60 * 60 * 1000;
                const fourHoursAgo = now - 4 * 60 * 60 * 1000;

                const recent1hCount = openTimes.filter(t => t >= oneHourAgo).length;
                const recent1to4hCount = openTimes.filter(t => t >= fourHoursAgo && t < oneHourAgo).length;

                let consensusMomentum: 'FORMING' | 'STABLE' | 'WEAKENING';
                if (openTimes.length === 0) {
                    consensusMomentum = 'STABLE';
                } else if (recent1hCount >= recent1to4hCount * 1.5) {
                    consensusMomentum = 'FORMING'; // Momentum increasing
                } else if (recent1hCount <= recent1to4hCount * 0.5) {
                    consensusMomentum = 'WEAKENING'; // Momentum decreasing
                } else {
                    consensusMomentum = 'STABLE'; // Momentum stable
                }

                // NEW: Calculate historicalWinRate (average of current traders' win rates)
                const traderWinRates = agg.traders
                    .map(t => t.winRate)
                    .filter((wr): wr is number => wr != null && !isNaN(wr));
                const historicalWinRate = traderWinRates.length > 0
                    ? Math.round((traderWinRates.reduce((sum, wr) => sum + wr, 0) / traderWinRates.length) * 100) / 100
                    : null;

                return {
                    symbol: agg.symbol,
                    longCount: agg.longCount,
                    shortCount: agg.shortCount,
                    totalTraders: agg.totalTraders,
                    avgLeverage: Math.round(agg.avgLeverage * 10) / 10,
                    weightedAvgLeverage,
                    totalVolume: Math.round(agg.totalVolume),
                    longVolume: Math.round(agg.longVolume),
                    shortVolume: Math.round(agg.shortVolume),
                    imbalance: agg.longCount - agg.shortCount,
                    sentiment: agg.longCount > agg.shortCount ? 'BULLISH' as const
                        : agg.shortCount > agg.longCount ? 'BEARISH' as const : 'NEUTRAL' as const,
                    // FAZ 1 consensus
                    sentimentScore: Math.round(sentimentScore * 10000) / 10000,
                    consensusDirection,
                    confidenceScore,
                    sumWeights,
                    derivedConfidenceAvg,
                    dataSource,
                    visibleTraderCount: agg.visibleTraderCount,
                    hiddenTraderCount: agg.hiddenTraderCount,
                    // YOL 2: P&L and timing aggregates
                    totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
                    avgRoe,
                    avgHoldDurationSeconds,
                    avgHoldDurationFormatted: avgHoldDurationSeconds
                        ? formatDuration(avgHoldDurationSeconds)
                        : null,
                    // YOL 2: LONG vs SHORT trader success comparison
                    traderComparison: {
                        long: {
                            traderCount: longTraderCount,
                            avgQuality: longAvgQuality,
                            avgWinRate: longAvgWinRate,
                            avgWeight: longAvgWeight,
                        },
                        short: {
                            traderCount: shortTraderCount,
                            avgQuality: shortAvgQuality,
                            avgWinRate: shortAvgWinRate,
                            avgWeight: shortAvgWeight,
                        },
                        strongerSide, // Which side has better traders
                    },
                    // NEW FIELDS FOR CONSENSUS TRADING
                    consensusAge, // ms since earliest position opened
                    consensusAgeFormatted: consensusAge ? formatDuration(Math.floor(consensusAge / 1000)) : null,
                    entryPriceSpread: Math.round(entryPriceSpread * 100) / 100, // % variance in entry prices
                    recommendedPositionSize, // % of portfolio (0-0.03)
                    topTraders,
                    // NEW FIELDS (Round 2)
                    consensusMomentum, // 'FORMING' | 'STABLE' | 'WEAKENING'
                    unrealizedPnL: Math.round(totalUnrealizedPnl * 100) / 100, // Aggregate unrealized P/L
                    historicalWinRate, // Average win rate of traders (0-1)
                    averageHoldTime: avgHoldDurationSeconds ? formatDuration(avgHoldDurationSeconds) : null, // Formatted average hold duration
                };
            })
            .sort((a, b) => b.confidenceScore - a.confidenceScore || b.totalTraders - a.totalTraders);

        return reply.send({
            success: true,
            data: results,
            meta: {
                totalSymbols: results.length,
                totalTraders: latestIngests.length,
                filters: {
                    timeRange,
                    side,
                    minTraders: minTradersNum,
                    leverage,
                    segment: segmentFilter,
                    recentlyOpened: recentlyOpened || null, // YOL 2: recently opened filter
                    recentlyOpenedActive: !!recentlyOpenedCutoff,
                }
            }
        });
    });

    // GET /signals/symbol/:symbol - Detailed position info for a specific symbol (FAZ 1: weighted)
    fastify.get('/signals/symbol/:symbol', async (
        request: FastifyRequest<{ Params: { symbol: string }; Querystring: SymbolQuery }>,
        reply: FastifyReply
    ) => {
        const { symbol } = request.params;
        const { timeRange = '24h', segment = 'BOTH' } = request.query;

        const timeRangeMs = getTimeRangeMs(timeRange);
        const segmentFilter = parseSegmentFilter(segment);
        const cutoffTime = timeRangeMs === Infinity
            ? new Date(0)
            : new Date(Date.now() - timeRangeMs);
        // const cutoffMs = cutoffTime.getTime(); // Unused for now
        const targetSymbol = String(symbol || '').toUpperCase();

        // Get latest ingests for each trader
        const latestIngests = await prisma.$queryRaw<Array<{ id: string; leadId: string; payload: any }>>`
      SELECT DISTINCT ON ("leadId") id, "leadId", payload
      FROM "RawIngest"
      WHERE "fetchedAt" >= ${cutoffTime}
      ORDER BY "leadId", "fetchedAt" DESC
    `;

        // FAZ 1: Batch-fetch weights + segment
        const leadIds = latestIngests.map(i => i.leadId);
        const [leadTraders, traderScores] = await Promise.all([
            prisma.leadTrader.findMany({
                where: { id: { in: leadIds } },
                select: { id: true, positionShow: true, nickname: true },
            }),
            prisma.traderScore.findMany({
                where: { leadId: { in: leadIds } },
                select: {
                    leadId: true,
                    traderWeight: true,
                    qualityScore: true,
                    confidence: true,
                    winRate: true,
                },
            }),
        ]);
        const ltMap = new Map(leadTraders.map(t => [t.id, t]));
        const scoreMap = new Map(traderScores.map(s => [s.leadId, s]));

        // Estimate leverages for HIDDEN traders
        const hiddenTraderIds = leadTraders
            .filter(t => t.positionShow === false)
            .map(t => t.id);
        const leverageEstimates = hiddenTraderIds.length > 0
            ? await batchEstimateLeverages(hiddenTraderIds)
            : new Map();

        const traders: TraderPosition[] = [];
        let totalLongVolume = 0;
        let totalShortVolume = 0;
        let avgEntryLong = 0;
        let avgEntryShort = 0;
        let weightedEntryLong = 0;
        let weightedEntryShort = 0;
        let longWeightSum = 0;
        let shortWeightSum = 0;
        let longCount = 0;
        let shortCount = 0;
        let derivedConfidenceSum = 0;
        let derivedTraderCount = 0;

        for (const ingest of latestIngests) {
            if (!ingest.payload) continue;

            const payload = ingest.payload;
            const portfolio = payload.portfolioDetail || {};
            const positions = payload.activePositions || [];
            // const orders = payload.orderHistory?.allOrders || []; // Unused for now
            const lt = ltMap.get(ingest.leadId);
            const score = scoreMap.get(ingest.leadId);
            const weight = score?.traderWeight ?? null;
            const traderSegment = resolveSegment(lt?.positionShow ?? null);
            if (!shouldIncludeSegment(traderSegment, segmentFilter)) continue;
            const nickname = portfolio.nickname || lt?.nickname || `Trader ${ingest.leadId.slice(-6)}`;
            const avatarUrl = portfolio.avatarUrl || '';

            if (traderSegment !== 'HIDDEN') {
                for (const pos of positions) {
                    if (String(pos.symbol || '').toUpperCase() !== targetSymbol) continue;
                    const normalizedSide = normalizePositionSide(pos.positionSide, pos.positionAmount);
                    if (!normalizedSide) continue;

                    const positionSide = normalizedSide;
                    const notionalValue = Math.abs(parseFloat(pos.notionalValue || '0'));
                    const entryPrice = parseFloat(pos.entryPrice || '0');
                    const positionAmount = Math.abs(parseFloat(pos.positionAmount || '0'));
                    const unrealizedPnl = parseFloat(pos.unrealizedProfit || '0');
                    const w = weight ?? 0;

                    if (positionSide === 'LONG') {
                        totalLongVolume += notionalValue;
                        avgEntryLong = (avgEntryLong * longCount + entryPrice) / (longCount + 1);
                        weightedEntryLong += entryPrice * w;
                        longWeightSum += w;
                        longCount++;
                    } else {
                        totalShortVolume += notionalValue;
                        avgEntryShort = (avgEntryShort * shortCount + entryPrice) / (shortCount + 1);
                        weightedEntryShort += entryPrice * w;
                        shortWeightSum += w;
                        shortCount++;
                    }

                    traders.push({
                        leadId: ingest.leadId,
                        nickname,
                        avatarUrl,
                        side: positionSide,
                        leverage: pos.leverage || 0,
                        entryPrice,
                        markPrice: parseFloat(pos.markPrice || '0'),
                        size: positionAmount,
                        pnl: unrealizedPnl,
                        pnlPercent: entryPrice > 0 ? (unrealizedPnl / (positionAmount * entryPrice)) * 100 : 0,
                        traderWeight: weight,
                        segment: traderSegment,
                        qualityScore: score?.qualityScore ?? null,
                        confidence: (score?.confidence as 'low' | 'medium' | 'high' | null) ?? null,
                        winRate: score?.winRate ?? null,
                        isDerived: false,
                        derivedConfidence: null,
                        lastAction: null,
                    });
                }
                continue;
            }

            // Get HIDDEN trader positions from PositionState table (matches heat map logic)
            const hiddenPosition = await prisma.positionState.findFirst({
                where: {
                    platform: 'binance',
                    leadId: ingest.leadId,
                    symbol: targetSymbol,
                    status: 'ACTIVE',
                    firstSeenAt: timeRangeMs === Infinity ? undefined : { gte: cutoffTime },
                },
                orderBy: {
                    estimatedOpenTime: 'desc',
                },
            });

            if (!hiddenPosition) continue;

            const normalizedSide = hiddenPosition.direction as 'LONG' | 'SHORT';
            if (!normalizedSide) continue;

            const w = weight ?? 0;
            const notional = hiddenPosition.entryPrice * hiddenPosition.amount;

            if (normalizedSide === 'LONG') {
                totalLongVolume += notional;
                avgEntryLong = (avgEntryLong * longCount + hiddenPosition.entryPrice) / (longCount + 1);
                weightedEntryLong += hiddenPosition.entryPrice * w;
                longWeightSum += w;
                longCount++;
            } else {
                totalShortVolume += notional;
                avgEntryShort = (avgEntryShort * shortCount + hiddenPosition.entryPrice) / (shortCount + 1);
                weightedEntryShort += hiddenPosition.entryPrice * w;
                shortWeightSum += w;
                shortCount++;
            }

            // Calculate confidence based on data source (matches heat map)
            const confidence = hiddenPosition.openEventId ? 0.85 : 0.70;
            derivedTraderCount++;
            derivedConfidenceSum += confidence;

            // Use estimated leverage for HIDDEN traders
            const leverageEstimate = leverageEstimates.get(ingest.leadId);
            const estimatedLeverage = hiddenPosition.leverage ?? leverageEstimate?.estimatedLeverage ?? null;

            traders.push({
                leadId: ingest.leadId,
                nickname,
                avatarUrl,
                side: normalizedSide,
                leverage: estimatedLeverage, // Estimated leverage for hidden traders
                entryPrice: hiddenPosition.entryPrice,
                markPrice: hiddenPosition.entryPrice, // No current price for HIDDEN
                size: hiddenPosition.amount,
                pnl: 0, // Can't calculate without current price
                pnlPercent: 0,
                traderWeight: weight,
                segment: traderSegment,
                qualityScore: score?.qualityScore ?? null,
                confidence: (score?.confidence as 'low' | 'medium' | 'high' | null) ?? null,
                winRate: score?.winRate ?? null,
                isDerived: true,
                derivedConfidence: Math.round(confidence * 10000) / 10000,
                lastAction: null, // Not available from PositionState
            });
        }

        // Sort by weight then PnL descending
        traders.sort((a, b) => (b.traderWeight ?? 0) - (a.traderWeight ?? 0) || b.pnl - a.pnl);

        // FAZ 1: Compute consensus for this symbol
        let longWeight = 0;
        let shortWeight = 0;
        for (const t of traders) {
            const w = t.traderWeight ?? 0;
            if (t.side === 'LONG') longWeight += w;
            else shortWeight += w;
        }
        const sentimentScore = computeSentimentScore(longWeight, shortWeight);
        const sumWeights = Math.round((longWeight + shortWeight) * 10000) / 10000;
        const confidenceScore = computeConfidenceScore(sentimentScore, traders.length, sumWeights);
        const consensusDirection = getConsensusDirection(sentimentScore);

        return reply.send({
            success: true,
            data: {
                symbol,
                summary: {
                    longCount,
                    shortCount,
                    totalTraders: longCount + shortCount,
                    totalLongVolume: Math.round(totalLongVolume),
                    totalShortVolume: Math.round(totalShortVolume),
                    avgEntryLong: Math.round(avgEntryLong * 100) / 100,
                    avgEntryShort: Math.round(avgEntryShort * 100) / 100,
                    weightedAvgEntryLong: longWeightSum > 0
                        ? Math.round((weightedEntryLong / longWeightSum) * 100) / 100 : 0,
                    weightedAvgEntryShort: shortWeightSum > 0
                        ? Math.round((weightedEntryShort / shortWeightSum) * 100) / 100 : 0,
                    sentiment: longCount > shortCount ? 'BULLISH' as const
                        : shortCount > longCount ? 'BEARISH' as const : 'NEUTRAL' as const,
                    sentimentScore: Math.round(sentimentScore * 10000) / 10000,
                    consensusDirection,
                    confidenceScore,
                    sumWeights,
                    derivedConfidenceAvg: derivedTraderCount > 0
                        ? Math.round((derivedConfidenceSum / derivedTraderCount) * 100)
                        : null,
                },
                traders
            },
            meta: { timeRange, segment: segmentFilter }
        });
    });

    // GET /signals/traders - List all unique traders with summary + FAZ 0 segment/weight
    fastify.get('/signals/traders', async (
        request: FastifyRequest<{ Querystring: { includePerformance?: string; daysBack?: string } }>,
        reply: FastifyReply
    ) => {
        const includePerformance = request.query.includePerformance === 'true';
        const daysBack = parseInt(request.query.daysBack || '30');
        // Get latest ingest for each trader
        const latestIngests = await prisma.$queryRaw<Array<{ id: string; leadId: string; payload: any; fetchedAt: Date }>>`
      SELECT DISTINCT ON ("leadId") id, "leadId", payload, "fetchedAt"
      FROM "RawIngest"
      ORDER BY "leadId", "fetchedAt" DESC
    `;

        // Batch-fetch LeadTrader + TraderScore for segment/weight data
        const leadIds = latestIngests.map(i => i.leadId);
        const [leadTraders, traderScores] = await Promise.all([
            prisma.leadTrader.findMany({
                where: { id: { in: leadIds } },
                select: { id: true, positionShow: true, nickname: true },
            }),
            prisma.traderScore.findMany({
                where: { leadId: { in: leadIds } },
                select: { leadId: true, qualityScore: true, traderWeight: true, confidence: true, winRate: true },
            }),
        ]);

        const traderMap = new Map(leadTraders.map(t => [t.id, t]));
        const scoreMap = new Map(traderScores.map(s => [s.leadId, s]));

        // Optionally calculate performance metrics
        const performanceMap = includePerformance
            ? await batchCalculatePerformance(leadIds, daysBack)
            : new Map();

        const traders = latestIngests.map(ingest => {
            const portfolio = ingest.payload?.portfolioDetail || {};
            const positions = ingest.payload?.activePositions || [];
            const lt = traderMap.get(ingest.leadId);
            const sc = scoreMap.get(ingest.leadId);

            const positionShow = lt?.positionShow ?? null;
            const segment: 'VISIBLE' | 'HIDDEN' | 'UNKNOWN' =
                positionShow === true ? 'VISIBLE' :
                positionShow === false ? 'HIDDEN' : 'UNKNOWN';

            const perf = performanceMap.get(ingest.leadId);

            return {
                leadId: ingest.leadId,
                nickname: portfolio.nickname || lt?.nickname || `Trader ${ingest.leadId.slice(-6)}`,
                avatarUrl: portfolio.avatarUrl || '',
                badgeName: portfolio.badgeName || '',
                positionsCount: positions.length,
                totalPnl: positions.reduce((sum: number, p: any) =>
                    sum + parseFloat(p.unrealizedProfit || '0'), 0
                ),
                lastUpdate: ingest.fetchedAt,
                // FAZ 0 fields
                positionShow,
                segment,
                qualityScore: sc?.qualityScore ?? null,
                traderWeight: sc?.traderWeight ?? null,
                confidence: sc?.confidence ?? null,
                winRate: sc?.winRate ?? null,
                // Performance metrics (if requested)
                ...(includePerformance && perf ? {
                    performance: {
                        // Returns
                        roi30d: perf.roi30d,
                        pnl30d: perf.pnl30d,
                        sharpeRatio: perf.sharpeRatio,
                        // Risk
                        maxDrawdown: perf.maxDrawdown,
                        avgLeverage: perf.avgLeverage,
                        // Trade metrics
                        totalTrades: perf.totalTrades,
                        winRate: perf.winRate,
                        avgWin: perf.avgWin,
                        avgLoss: perf.avgLoss,
                        profitFactor: perf.profitFactor,
                        // Activity
                        tradesPerDay: perf.tradesPerDay,
                        closesPerDay: perf.closesPerDay,
                        avgHoldTime: perf.avgHoldTime,
                        // Sample
                        sampleSize: perf.sampleSize,
                        dataFrom: perf.dataFrom,
                        dataTo: perf.dataTo,
                    }
                } : {}),
            };
        });

        return reply.send({
            success: true,
            data: traders,
            meta: { total: traders.length }
        });
    });

    // GET /signals/feed - Unified feed (positions + derived from orders)
    fastify.get('/signals/feed', async (
        request: FastifyRequest<{ Querystring: FeedQuery }>,
        reply: FastifyReply
    ) => {
        const { source = 'all', limit = '50', symbol, timeRange = '24h', segment = 'BOTH' } = request.query;
        const limitNum = parseInt(limit) || 50;
        const symbolFilter = (symbol || '').trim().toUpperCase();
        const timeRangeMs = getTimeRangeMs(timeRange);
        const segmentFilter = parseSegmentFilter(segment);
        const cutoffTime = timeRangeMs === Infinity
            ? new Date(0)
            : new Date(Date.now() - timeRangeMs);

        const latestIngests = timeRangeMs === Infinity
            ? await prisma.$queryRaw<Array<{ id: string; leadId: string; payload: any; fetchedAt: Date }>>`
        SELECT DISTINCT ON ("leadId") id, "leadId", payload, "fetchedAt"
        FROM "RawIngest"
        ORDER BY "leadId", "fetchedAt" DESC
      `
            : await prisma.$queryRaw<Array<{ id: string; leadId: string; payload: any; fetchedAt: Date }>>`
        SELECT DISTINCT ON ("leadId") id, "leadId", payload, "fetchedAt"
        FROM "RawIngest"
        WHERE "fetchedAt" >= ${cutoffTime}
        ORDER BY "leadId", "fetchedAt" DESC
      `;

        const leadIds = latestIngests.map(i => i.leadId);
        const [leadTraders, traderScores] = await Promise.all([
            prisma.leadTrader.findMany({
                where: { id: { in: leadIds } },
                select: { id: true, positionShow: true, nickname: true },
            }),
            prisma.traderScore.findMany({
                where: { leadId: { in: leadIds } },
                select: {
                    leadId: true,
                    traderWeight: true,
                    qualityScore: true,
                    confidence: true,
                    winRate: true,
                },
            }),
        ]);
        const traderMap = new Map(leadTraders.map(t => [t.id, t]));
        const scoreMap = new Map(traderScores.map(s => [s.leadId, s]));

        interface FeedItem {
            leadId: string;
            nickname: string;
            symbol: string;
            action: string;
            side: string;
            notional: number;
            leverage: number | null;
            pnl: number;
            timestamp: number;
            source: 'POSITIONS' | 'DERIVED';
            segment: 'VISIBLE' | 'HIDDEN' | 'UNKNOWN';
            traderWeight: number | null;
            qualityScore: number | null;
            confidence: 'low' | 'medium' | 'high' | null;
            winRate: number | null;
        }

        const feed: FeedItem[] = [];

        for (const ingest of latestIngests) {
            const portfolio = ingest.payload?.portfolioDetail || {};
            const positions = ingest.payload?.activePositions || [];
            const orders = ingest.payload?.orderHistory?.allOrders || [];
            const trader = traderMap.get(ingest.leadId);
            const score = scoreMap.get(ingest.leadId);
            const positionShow = trader?.positionShow ?? null;
            const traderSegment = resolveSegment(positionShow);
            if (!shouldIncludeSegment(traderSegment, segmentFilter)) continue;
            const nickname = portfolio.nickname || trader?.nickname || `Trader ${ingest.leadId.slice(-6)}`;

            // Check if positions are visible
            const hasPositions = positions.length > 0 && positions[0]?.symbol;

            if ((source === 'all' || source === 'positions') && hasPositions) {
                // Add from positions
                for (const pos of positions) {
                    if (symbolFilter && String(pos.symbol || '').toUpperCase() !== symbolFilter) continue;
                    const normalizedSide = normalizePositionSide(pos.positionSide, pos.positionAmount);
                    if (!normalizedSide) continue;
                    feed.push({
                        leadId: ingest.leadId,
                        nickname,
                        symbol: pos.symbol,
                        action: normalizedSide === 'LONG' ? 'HOLDING_LONG' : 'HOLDING_SHORT',
                        side: normalizedSide,
                        notional: Math.abs(parseFloat(pos.notionalValue || '0')),
                        leverage: pos.leverage || null,
                        pnl: parseFloat(pos.unrealizedProfit || '0'),
                        timestamp: ingest.fetchedAt.getTime(),
                        source: 'POSITIONS' as const,
                        segment: traderSegment,
                        traderWeight: score?.traderWeight ?? null,
                        qualityScore: score?.qualityScore ?? null,
                        confidence: (score?.confidence as 'low' | 'medium' | 'high' | null) ?? null,
                        winRate: score?.winRate ?? null,
                    });
                }
            }

            if ((source === 'all' || source === 'derived') && orders.length > 0) {
                // Derive from order history
                for (const order of orders) {
                    if (symbolFilter && String(order.symbol || '').toUpperCase() !== symbolFilter) continue;
                    const orderTs = Number(order.orderTime || 0);
                    if (timeRangeMs !== Infinity && orderTs > 0 && orderTs < cutoffTime.getTime()) continue;
                    const action = getOrderAction(order.side, order.positionSide);
                    const executedQty = parseFloat(String(order.executedQty || '0'));
                    const avgPrice = parseFloat(String(order.avgPrice || '0'));
                    feed.push({
                        leadId: ingest.leadId,
                        nickname,
                        symbol: order.symbol,
                        action,
                        side: order.positionSide,
                        notional: Math.abs(executedQty * avgPrice),
                        leverage: null,
                        pnl: order.totalPnl || 0,
                        timestamp: orderTs,
                        source: 'DERIVED' as const,
                        segment: traderSegment,
                        traderWeight: score?.traderWeight ?? null,
                        qualityScore: score?.qualityScore ?? null,
                        confidence: (score?.confidence as 'low' | 'medium' | 'high' | null) ?? null,
                        winRate: score?.winRate ?? null,
                    });
                }
            }
        }

        // Sort by timestamp descending and limit
        feed.sort((a, b) => b.timestamp - a.timestamp);
        const limitedFeed = feed.slice(0, limitNum);

        return reply.send({
            success: true,
            data: limitedFeed,
            meta: {
                total: feed.length,
                returned: limitedFeed.length,
                source,
                segment: segmentFilter,
                symbol: symbolFilter || null,
                timeRange,
            }
        });
    });

    // GET /signals/latest-records/feed - Latest Records from ALL traders (smart aggregation)
    fastify.get('/signals/latest-records/feed', async (
        request: FastifyRequest<{ Querystring: FeedQuery }>,
        reply: FastifyReply
    ) => {
        const { limit = '200', timeRange = 'ALL' } = request.query;
        const limitNum = Math.min(parseInt(limit) || 200, 1000);

        console.log(`[DEBUG] latestRecords: Fetching latest activity for ALL traders`);

        // Get ALL traders
        const allTraders = await prisma.leadTrader.findMany({
            select: { id: true }
        });

        console.log(`[DEBUG] latestRecords: Found ${allTraders.length} traders`);

        // Get recent events for each trader (last 20 events per trader to ensure we capture their activity)
        const eventsPerTrader = await Promise.all(
            allTraders.map(async (trader) => {
                return await prisma.event.findMany({
                    where: {
                        leadId: trader.id,
                        eventType: { in: ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'] },
                        eventTime: { not: null }
                    },
                    include: {
                        leadTrader: {
                            select: { nickname: true, positionShow: true }
                        }
                    },
                    orderBy: { eventTime: 'desc' },
                    take: 20 // Last 20 events per trader
                });
            })
        );

        // Flatten all events
        const events = eventsPerTrader.flat();

        console.log(`[DEBUG] latestRecords: Found ${events.length} events`);

        // Group by (leadId, symbol, direction)
        const grouped = new Map<string, {
            leadId: string;
            symbol: string;
            direction: 'LONG' | 'SHORT';
            nickname: string;
            positionShow: boolean | null;
            opens: typeof events;
            closes: typeof events;
        }>();

        for (const event of events) {
            const direction = event.eventType.includes('LONG') ? 'LONG' : 'SHORT';
            const groupKey = `${event.leadId}:${event.symbol}:${direction}`;

            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, {
                    leadId: event.leadId,
                    symbol: event.symbol,
                    direction,
                    nickname: event.leadTrader.nickname || 'Unknown',
                    positionShow: event.leadTrader.positionShow,
                    opens: [],
                    closes: []
                });
            }

            const group = grouped.get(groupKey)!;
            if (event.eventType.startsWith('OPEN')) {
                group.opens.push(event);
            } else {
                group.closes.push(event);
            }
        }

        // Aggregate each group
        const aggregatedRecords = Array.from(grouped.values()).map(group => {
            // Get latest timestamp (most recent trade)
            const allTimes = [...group.opens, ...group.closes].map(e => e.eventTime?.getTime() || 0);
            const latestTime = Math.max(...allTimes);

            // Sum amounts
            const totalOpened = group.opens.reduce((sum, e) => sum + (e.amount || 0), 0);
            const totalClosed = group.closes.reduce((sum, e) => sum + (e.amount || 0), 0);

            // Calculate close percentage
            const closePercentage = totalOpened > 0 ? (totalClosed / totalOpened) * 100 : 0;

            // Determine status
            let status: string;
            if (group.closes.length === 0) {
                status = 'OPEN_ONLY';
            } else if (totalClosed >= totalOpened) {
                status = totalClosed > totalOpened ? 'OVER_CLOSE' : 'FULL_CLOSE';
            } else {
                status = 'PARTIAL_CLOSE';
            }

            // Calculate average prices (weighted by amount, filter out zero prices)
            const opensWithPrice = group.opens.filter(e => (e.price || 0) > 0);
            const closesWithPrice = group.closes.filter(e => (e.price || 0) > 0);

            const avgOpenPrice = opensWithPrice.length > 0 && totalOpened > 0
                ? opensWithPrice.reduce((sum, e) => sum + ((e.price || 0) * (e.amount || 0)), 0) / totalOpened
                : (group.opens[0]?.price || 0);
            const avgClosePrice = closesWithPrice.length > 0 && totalClosed > 0
                ? closesWithPrice.reduce((sum, e) => sum + ((e.price || 0) * (e.amount || 0)), 0) / totalClosed
                : (group.closes[0]?.price || 0);

            return {
                leadId: group.leadId,
                nickname: group.nickname,
                positionShow: group.positionShow,
                symbol: group.symbol,
                direction: group.direction,
                eventTime: latestTime,
                totalOpened,
                totalClosed,
                closePercentage: Math.round(closePercentage * 100) / 100,
                status,
                avgOpenPrice: Math.round(avgOpenPrice * 100) / 100,
                avgClosePrice: Math.round(avgClosePrice * 100) / 100,
                openCount: group.opens.length,
                closeCount: group.closes.length,
                // UI compatibility
                side: group.direction,
                eventType: status === 'OPEN_ONLY' ? `OPEN_${group.direction}` : `CLOSE_${group.direction}`,
                price: status === 'OPEN_ONLY' ? avgOpenPrice : avgClosePrice,
                amount: status === 'OPEN_ONLY' ? totalOpened : totalClosed
            };
        });

        // Sort by latest event time descending
        aggregatedRecords.sort((a, b) => b.eventTime - a.eventTime);

        // Limit results
        const limitedRecords = aggregatedRecords.slice(0, limitNum);

        console.log(`[DEBUG] latestRecords: {events:${events.length},groups:${aggregatedRecords.length},returned:${limitedRecords.length}}`);

        return reply.send({
            success: true,
            data: limitedRecords,
            meta: {
                totalEvents: events.length,
                aggregatedGroups: aggregatedRecords.length,
                returned: limitedRecords.length,
                timeRange: timeRange,
                source: 'events'
            }
        });
    });

    // GET /signals/events/feed - Real event timeline (OPEN/CLOSE from Event table)
    fastify.get('/signals/events/feed', async (
        request: FastifyRequest<{ Querystring: FeedQuery }>,
        reply: FastifyReply
    ) => {
        const { limit = '100', symbol, timeRange = '24h', segment = 'BOTH' } = request.query;
        const limitNum = Math.min(parseInt(limit) || 100, 500); // Max 500
        const symbolFilter = (symbol || '').trim().toUpperCase();
        const timeRangeMs = getTimeRangeMs(timeRange);
        const segmentFilter = parseSegmentFilter(segment);
        const cutoffTime = timeRangeMs === Infinity
            ? new Date(0)
            : new Date(Date.now() - timeRangeMs);

        // Query Event table for real OPEN/CLOSE events
        const events = await prisma.event.findMany({
            where: {
                eventType: { in: ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT'] },
                eventTime: { gte: cutoffTime },
                ...(symbolFilter ? { symbol: symbolFilter } : {}),
            },
            include: {
                leadTrader: {
                    select: { nickname: true, positionShow: true }
                },
            },
            orderBy: { eventTime: 'desc' }, // Newest first
            take: limitNum * 2, // Fetch extra in case of segment filtering
        });

        // Get trader scores for all unique leadIds
        const leadIds = [...new Set(events.map(e => e.leadId))];
        const traderScores = await prisma.traderScore.findMany({
            where: { leadId: { in: leadIds } },
            select: {
                leadId: true,
                traderWeight: true,
                qualityScore: true,
                confidence: true,
                winRate: true,
            },
        });
        const scoreMap = new Map(traderScores.map(s => [s.leadId, s]));

        interface EventFeedItem {
            eventId: string;
            leadId: string;
            nickname: string;
            eventType: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';
            symbol: string;
            price: number;
            amount: number;
            leverage: number | null;
            realizedPnl: number | null;
            eventTime: number;
            segment: 'VISIBLE' | 'HIDDEN' | 'UNKNOWN';
            traderWeight: number | null;
            qualityScore: number | null;
            confidence: 'low' | 'medium' | 'high' | null;
            winRate: number | null;
        }

        const feed: EventFeedItem[] = [];

        for (const event of events) {
            const positionShow = event.leadTrader?.positionShow ?? null;
            const traderSegment = resolveSegment(positionShow);

            // Apply segment filter
            if (!shouldIncludeSegment(traderSegment, segmentFilter)) continue;

            const score = scoreMap.get(event.leadId);
            const nickname = event.leadTrader?.nickname || `Trader ${event.leadId.slice(-6)}`;

            feed.push({
                eventId: event.id,
                leadId: event.leadId,
                nickname,
                eventType: event.eventType as 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT',
                symbol: event.symbol,
                price: event.price || 0,
                amount: event.amount || 0,
                leverage: null, // Events don't track leverage
                realizedPnl: event.realizedPnl,
                eventTime: event.eventTime ? event.eventTime.getTime() : Date.now(),
                segment: traderSegment,
                traderWeight: score?.traderWeight ?? null,
                qualityScore: score?.qualityScore ?? null,
                confidence: (score?.confidence as 'low' | 'medium' | 'high' | null) ?? null,
                winRate: score?.winRate ?? null,
            });

            // Stop if we have enough after filtering
            if (feed.length >= limitNum) break;
        }

        return reply.send({
            success: true,
            data: feed,
            meta: {
                total: feed.length,
                returned: feed.length,
                segment: segmentFilter,
                symbol: symbolFilter || null,
                timeRange,
            }
        });
    });

    // GET /signals/insights/rule - persistent FAZ 6 presets
    fastify.get('/signals/insights/rule', async (
        _request: FastifyRequest,
        reply: FastifyReply,
    ) => {
        const row = await getOrCreateInsightsRule();
        const rule = normalizeInsightsRule(row);
        return reply.send({ success: true, data: rule });
    });

    // PUT /signals/insights/rule - update persistent FAZ 6 presets
    fastify.put('/signals/insights/rule', async (
        request: FastifyRequest<{ Body: InsightsRuleUpdateBody }>,
        reply: FastifyReply,
    ) => {
        const row = await getOrCreateInsightsRule();
        const current = normalizeInsightsRule(row);
        const body = request.body || {};

        const rawDefaultMode = typeof body.defaultMode === 'string'
            ? body.defaultMode
            : undefined;
        const hasValidDefaultModePatch =
            rawDefaultMode === 'conservative' || rawDefaultMode === 'balanced' || rawDefaultMode === 'aggressive';
        const defaultMode = hasValidDefaultModePatch
            ? rawDefaultMode
            : current.defaultMode;

        const presetsPatch = (body.presets && typeof body.presets === 'object')
            ? body.presets
            : undefined;

        if (!hasValidDefaultModePatch && !presetsPatch) {
            return reply.send({ success: true, data: current, meta: { updated: false } });
        }

        const merged = {
            conservative: sanitizeInsightsPreset(
                { ...current.presets.conservative, ...(presetsPatch?.conservative || {}) },
                current.presets.conservative,
            ),
            balanced: sanitizeInsightsPreset(
                { ...current.presets.balanced, ...(presetsPatch?.balanced || {}) },
                current.presets.balanced,
            ),
            aggressive: sanitizeInsightsPreset(
                { ...current.presets.aggressive, ...(presetsPatch?.aggressive || {}) },
                current.presets.aggressive,
            ),
        };

        const updated = await prisma.insightsRule.update({
            where: { id: row.id },
            data: {
                defaultMode,
                conservativePreset: merged.conservative as unknown as Prisma.InputJsonValue,
                balancedPreset: merged.balanced as unknown as Prisma.InputJsonValue,
                aggressivePreset: merged.aggressive as unknown as Prisma.InputJsonValue,
            },
        });

        return reply.send({
            success: true,
            data: normalizeInsightsRule(updated),
            meta: { updated: true },
        });
    });

    // GET /signals/insights - FAZ 6: risk/anomaly + stability + leaderboard
    fastify.get('/signals/insights', async (
        request: FastifyRequest<{ Querystring: InsightsQuery }>,
        reply: FastifyReply,
    ) => {
        const ruleRow = await getOrCreateInsightsRule();
        const rule = normalizeInsightsRule(ruleRow);
        const timeRange = normalizeTimeRange(request.query.timeRange);
        const segmentFilter = parseSegmentFilter(request.query.segment);
        const top = parseTopLimit(request.query.top, 10);
        const mode = normalizeInsightsMode(request.query.mode || rule.defaultMode);

        const data = await runPhase6Insights({
            timeRange,
            segmentFilter,
            top,
            mode,
            preset: rule.presets[mode],
        });

        return reply.send({
            success: true,
            data,
            meta: {
                timeRange,
                segment: segmentFilter,
                top,
                mode,
                defaultMode: rule.defaultMode,
            },
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // FAZ 4: SIMULATION MODE (manual open/close + performance report)
    // ═══════════════════════════════════════════════════════════════

    // POST /signals/simulation/open
    fastify.post('/signals/simulation/open', async (
        request: FastifyRequest<{ Body: SimulationOpenBody }>,
        reply: FastifyReply,
    ) => {
        const body = request.body || ({} as SimulationOpenBody);
        const symbol = String(body.symbol || '').trim().toUpperCase();
        const direction = body.direction;
        const leverage = Number(body.leverage ?? 10);
        const marginNotional = Number(body.notional ?? 100);

        if (!symbol) {
            return reply.status(400).send({ success: false, error: 'symbol is required' });
        }
        if (direction !== 'LONG' && direction !== 'SHORT') {
            return reply.status(400).send({ success: false, error: 'direction must be LONG or SHORT' });
        }
        if (!Number.isFinite(leverage) || leverage <= 0) {
            return reply.status(400).send({ success: false, error: 'leverage must be > 0' });
        }
        if (!Number.isFinite(marginNotional) || marginNotional <= 0) {
            return reply.status(400).send({ success: false, error: 'notional must be > 0' });
        }

        let entryPrice = Number(body.entryPrice ?? 0);
        if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
            const reference = await getReferenceEntryPrice(symbol);
            if (!reference) {
                return reply.status(400).send({
                    success: false,
                    error: 'entryPrice not provided and no reference market price found',
                });
            }
            entryPrice = reference;
        }

        const perfPreview = computeSimulationPerformance({
            direction,
            entryPrice,
            exitPrice: entryPrice,
            leverage,
            marginNotional,
        });

        const created = await prisma.simulatedPosition.create({
            data: {
                platform: 'binance',
                symbol,
                direction,
                status: 'OPEN',
                leverage: round4(leverage),
                marginNotional: round4(marginNotional),
                positionNotional: perfPreview.positionNotional,
                entryPrice: round4(entryPrice),
                source: 'MANUAL',
                notes: body.notes ?? null,
            },
        });

        return reply.send({ success: true, data: created });
    });

    // POST /signals/simulation/:id/close
    fastify.post('/signals/simulation/:id/close', async (
        request: FastifyRequest<{ Params: { id: string }; Body: SimulationCloseBody }>,
        reply: FastifyReply,
    ) => {
        const { id } = request.params;
        const body = request.body || {};

        const openPos = await prisma.simulatedPosition.findUnique({ where: { id } });
        if (!openPos || openPos.status !== 'OPEN') {
            return reply.status(404).send({ success: false, error: 'Open simulation position not found' });
        }

        let exitPrice = Number(body.exitPrice ?? 0);
        if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
            const reference = await getReferenceEntryPrice(openPos.symbol);
            exitPrice = reference && reference > 0 ? reference : openPos.entryPrice;
        }

        const perf = computeSimulationPerformance({
            direction: openPos.direction as 'LONG' | 'SHORT',
            entryPrice: openPos.entryPrice,
            exitPrice,
            leverage: openPos.leverage,
            marginNotional: openPos.marginNotional,
        });

        const updated = await prisma.simulatedPosition.update({
            where: { id },
            data: {
                status: 'CLOSED',
                exitPrice: round4(exitPrice),
                closedAt: new Date(),
                closeReason: body.reason || 'MANUAL_CLOSE',
                closeTriggerLeadId: null,
                closeTriggerEventType: null,
                pnlUSDT: perf.pnlUSDT,
                roiPct: perf.roiPct,
                positionNotional: perf.positionNotional,
            },
        });

        return reply.send({ success: true, data: updated });
    });

    // POST /signals/simulation/reconcile - auto-close when first trader closes
    fastify.post('/signals/simulation/reconcile', async (
        _request: FastifyRequest,
        reply: FastifyReply,
    ) => {
        const closed = await reconcileOpenSimulatedPositions();
        return reply.send({
            success: true,
            data: {
                closedCount: closed.length,
                closed,
            },
        });
    });

    // GET /signals/simulation/reconcile - convenience alias
    fastify.get('/signals/simulation/reconcile', async (
        _request: FastifyRequest,
        reply: FastifyReply,
    ) => {
        const closed = await reconcileOpenSimulatedPositions();
        return reply.send({
            success: true,
            data: {
                closedCount: closed.length,
                closed,
            },
        });
    });

    // GET /signals/simulation/positions
    fastify.get('/signals/simulation/positions', async (
        request: FastifyRequest<{ Querystring: SimulationPositionsQuery }>,
        reply: FastifyReply,
    ) => {
        const status = parseSimulationStatus(request.query.status);
        const limit = Math.max(1, Math.min(parseInt(request.query.limit || '100') || 100, 500));
        const shouldReconcile = request.query.reconcile === '1' || request.query.reconcile === 'true';

        if (shouldReconcile) {
            await reconcileOpenSimulatedPositions();
        }

        const where = status === 'ALL'
            ? { platform: 'binance' as const }
            : { platform: 'binance' as const, status };

        const positions = await prisma.simulatedPosition.findMany({
            where,
            orderBy: { openedAt: 'desc' },
            take: limit,
        });

        return reply.send({
            success: true,
            data: positions,
            meta: { status, returned: positions.length, reconcile: shouldReconcile },
        });
    });

    // GET /signals/simulation/report
    fastify.get('/signals/simulation/report', async (
        _request: FastifyRequest,
        reply: FastifyReply,
    ) => {
        // Keep report fresh by reconciling open positions first.
        await reconcileOpenSimulatedPositions();

        const [all, open, closed] = await Promise.all([
            prisma.simulatedPosition.count({ where: { platform: 'binance' } }),
            prisma.simulatedPosition.count({ where: { platform: 'binance', status: 'OPEN' } }),
            prisma.simulatedPosition.findMany({
                where: { platform: 'binance', status: 'CLOSED' },
                orderBy: { closedAt: 'desc' },
            }),
        ]);

        const wins = closed.filter((p) => (p.pnlUSDT ?? 0) > 0).length;
        const losses = closed.filter((p) => (p.pnlUSDT ?? 0) < 0).length;
        const breakeven = closed.length - wins - losses;
        const totalPnl = round4(closed.reduce((sum, p) => sum + (p.pnlUSDT ?? 0), 0));
        const avgPnl = closed.length > 0 ? round4(totalPnl / closed.length) : 0;
        const avgRoiPct = closed.length > 0
            ? round4(closed.reduce((sum, p) => sum + (p.roiPct ?? 0), 0) / closed.length)
            : 0;
        const winRate = closed.length > 0 ? round4((wins / closed.length) * 100) : 0;

        const bySymbolMap = new Map<string, { trades: number; pnl: number; wins: number }>();
        for (const p of closed) {
            const current = bySymbolMap.get(p.symbol) || { trades: 0, pnl: 0, wins: 0 };
            current.trades += 1;
            current.pnl += p.pnlUSDT ?? 0;
            if ((p.pnlUSDT ?? 0) > 0) current.wins += 1;
            bySymbolMap.set(p.symbol, current);
        }
        const bySymbol = Array.from(bySymbolMap.entries())
            .map(([symbol, row]) => ({
                symbol,
                trades: row.trades,
                totalPnl: round4(row.pnl),
                winRate: row.trades > 0 ? round4((row.wins / row.trades) * 100) : 0,
            }))
            .sort((a, b) => b.totalPnl - a.totalPnl);

        return reply.send({
            success: true,
            data: {
                totals: {
                    all,
                    open,
                    closed: closed.length,
                    wins,
                    losses,
                    breakeven,
                    winRate,
                    totalPnl,
                    avgPnl,
                    avgRoiPct,
                },
                bySymbol,
                recentClosed: closed.slice(0, 20),
            },
        });
    });

    // GET /signals/simulation/auto-rule
    fastify.get('/signals/simulation/auto-rule', async (
        _request: FastifyRequest,
        reply: FastifyReply,
    ) => {
        const rule = await getOrCreateAutoTriggerRule();
        return reply.send({ success: true, data: rule });
    });

    // PUT /signals/simulation/auto-rule
    fastify.put('/signals/simulation/auto-rule', async (
        request: FastifyRequest<{ Body: AutoRuleUpdateBody }>,
        reply: FastifyReply,
    ) => {
        const current = await getOrCreateAutoTriggerRule();
        const body = request.body || {};
        const updateData: Record<string, unknown> = {};

        if (typeof body.enabled === 'boolean') updateData.enabled = body.enabled;
        if (body.segment && ['VISIBLE', 'HIDDEN', 'BOTH'].includes(body.segment)) updateData.segment = body.segment;
        if (body.timeRange && ['1h', '4h', '24h', '7d', 'ALL'].includes(body.timeRange)) updateData.timeRange = body.timeRange;
        if (typeof body.minTraders === 'number' && body.minTraders >= 1) updateData.minTraders = Math.floor(body.minTraders);
        if (typeof body.minConfidence === 'number') updateData.minConfidence = Math.max(0, Math.min(100, Math.floor(body.minConfidence)));
        if (typeof body.minSentimentAbs === 'number') updateData.minSentimentAbs = Math.max(0, Math.min(100, Math.floor(body.minSentimentAbs)));
        if (typeof body.leverage === 'number' && body.leverage > 0) updateData.leverage = round4(body.leverage);
        if (typeof body.marginNotional === 'number' && body.marginNotional > 0) updateData.marginNotional = round4(body.marginNotional);
        if (typeof body.cooldownMinutes === 'number' && body.cooldownMinutes >= 0) updateData.cooldownMinutes = Math.floor(body.cooldownMinutes);

        if (Object.keys(updateData).length === 0) {
            return reply.send({ success: true, data: current, meta: { updated: false } });
        }

        const updated = await prisma.autoTriggerRule.update({
            where: { id: current.id },
            data: updateData,
        });
        return reply.send({ success: true, data: updated, meta: { updated: true } });
    });

    // POST /signals/simulation/auto-run
    fastify.post('/signals/simulation/auto-run', async (
        request: FastifyRequest<{ Querystring: AutoRunQuery }>,
        reply: FastifyReply,
    ) => {
        const dryRun = parseBool(request.query.dryRun);
        const result = await runAutoTriggerEngine({ dryRun });
        return reply.send({ success: true, data: result });
    });

    // GET /signals/simulation/backtest-lite
    fastify.get('/signals/simulation/backtest-lite', async (
        request: FastifyRequest<{ Querystring: BacktestLiteQuery }>,
        reply: FastifyReply,
    ) => {
        const rule = await getOrCreateAutoTriggerRule();
        const timeRange = request.query.timeRange || rule.timeRange;
        const segmentFilter = parseSegmentFilter(request.query.segment || rule.segment);
        const minTraders = Math.max(1, parseInt(request.query.minTraders || String(rule.minTraders)) || rule.minTraders);
        const minConfidence = Math.max(0, Math.min(100, parseInt(request.query.minConfidence || String(rule.minConfidence)) || rule.minConfidence));
        const minSentimentAbs = Math.max(0, Math.min(100, parseInt(request.query.minSentimentAbs || String(rule.minSentimentAbs)) || rule.minSentimentAbs));
        const leverage = Math.max(0.1, parseFloat(request.query.leverage || String(rule.leverage)) || rule.leverage);
        const marginNotional = Math.max(1, parseFloat(request.query.marginNotional || String(rule.marginNotional)) || rule.marginNotional);

        // Sprint 2: Parse advanced analytics flags
        const advancedMetrics = parseBool(request.query.advancedMetrics);
        const monteCarlo = parseBool(request.query.monteCarlo);
        const walkForward = parseBool(request.query.walkForward);
        const equityCurve = parseBool(request.query.equityCurve);
        const numSimulations = Math.max(100, Math.min(10000, parseInt(request.query.numSimulations || '1000')));
        const persist = parseBool(request.query.persist);

        const result = await runBacktestLite({
            timeRange,
            segmentFilter,
            minTraders,
            minConfidence,
            minSentimentAbs,
            leverage,
            marginNotional,
            // Sprint 2 params
            advancedMetrics,
            monteCarlo,
            walkForward,
            equityCurve,
            numSimulations,
            persist,
        });
        return reply.send({ success: true, data: result });
    });

    // GET /signals/metrics/:leadId - Behavioral metrics for a trader
    // FAZ 0: Refactored to use computeTraderMetrics() from traderMetrics.ts
    fastify.get('/signals/metrics/:leadId', async (
        request: FastifyRequest<{ Params: { leadId: string } }>,
        reply: FastifyReply
    ) => {
        const { leadId } = request.params;

        const latestIngest = await prisma.rawIngest.findFirst({
            where: { leadId },
            orderBy: { fetchedAt: 'desc' },
        });

        if (!latestIngest) {
            return reply.status(404).send({ success: false, error: 'Trader not found' });
        }

        const metrics = computeTraderMetrics(latestIngest.payload);

        return reply.send({
            success: true,
            data: {
                leadId,
                nickname: metrics.nickname,
                tradeCounts: metrics.tradeCounts,
                winLoss: metrics.winLoss,
                streaks: metrics.streaks,
                pnl: {
                    totalRealizedPnl: metrics.totalRealizedPnl,
                    avgPnlPerTrade: metrics.avgPnlPerTrade,
                },
                leverage: metrics.leverage,
                qualityScore: {
                    score: metrics.qualityScore,
                    confidence: metrics.confidence,
                    sampleSize: metrics.sampleSize,
                    breakdown: metrics.scoreBreakdown,
                },
                dataAvailability: metrics.dataAvailability,
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // FAZ 0: DIAGNOSTIC ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    // GET /signals/diagnostic - Batch diagnostic for all traders
    fastify.get('/signals/diagnostic', async (
        _request: FastifyRequest,
        reply: FastifyReply
    ) => {
        const traders = await prisma.leadTrader.findMany({
            include: { traderScore: true },
        });

        const diagnostics = await Promise.all(
            traders.map(trader => buildDiagnostic(trader.id)),
        );

        const visibleTraders = diagnostics.filter(d => d.segment.positionShow === true).length;
        const hiddenTraders = diagnostics.filter(d => d.segment.positionShow === false).length;
        const unknownSegment = diagnostics.filter(d => d.segment.positionShow === null).length;
        const tradersWithIssues = diagnostics.filter(d => d.issues.length > 0).length;
        const weights = diagnostics.map(d => d.scoring.traderWeight).filter((w): w is number => w !== null);
        const averageWeight = weights.length > 0
            ? Math.round((weights.reduce((s, w) => s + w, 0) / weights.length) * 10000) / 10000
            : 0;

        return reply.send({
            success: true,
            data: {
                traders: diagnostics,
                summary: {
                    totalTraders: diagnostics.length,
                    visibleTraders,
                    hiddenTraders,
                    unknownSegment,
                    tradersWithIssues,
                    averageWeight,
                    readyForConsensus: tradersWithIssues === 0 && unknownSegment === 0,
                },
            },
        });
    });

    // GET /signals/diagnostic/:leadId - Single trader diagnostic
    fastify.get('/signals/diagnostic/:leadId', async (
        request: FastifyRequest<{ Params: { leadId: string } }>,
        reply: FastifyReply
    ) => {
        const { leadId } = request.params;
        const diagnostic = await buildDiagnostic(leadId);
        return reply.send({ success: true, data: diagnostic });
    });

    // ═══════════════════════════════════════════════════════════════
    // YOL 2: POSITION STATE TRACKING ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    // GET /signals/position-states/active/:leadId - Active positions for a trader
    fastify.get('/signals/position-states/active/:leadId', async (
        request: FastifyRequest<{
            Params: { leadId: string };
            Querystring: { platform?: string };
        }>,
        reply: FastifyReply
    ) => {
        const { leadId } = request.params;
        const platform = (request.query.platform as string) || 'binance';

        const positions = await getActivePositionStates(leadId, platform);

        // Add uncertainty ranges
        const enriched = positions.map(pos => ({
            ...pos,
            uncertaintyRange: calculateUncertaintyRange(pos),
        }));

        return reply.send({
            success: true,
            data: {
                leadId,
                platform,
                activePositions: enriched.length,
                positions: enriched,
            },
        });
    });

    // GET /signals/position-states/symbol/:symbol - Position history for a symbol
    fastify.get('/signals/position-states/symbol/:symbol', async (
        request: FastifyRequest<{
            Params: { symbol: string };
            Querystring: { platform?: string; limit?: string };
        }>,
        reply: FastifyReply
    ) => {
        const { symbol } = request.params;
        const platform = (request.query.platform as string) || 'binance';
        const limit = parseInt((request.query.limit as string) || '50', 10);

        const history = await getPositionStateHistory(symbol, platform, limit);

        // Add uncertainty ranges and aggregate stats
        const enriched = history.map(pos => ({
            ...pos,
            uncertaintyRange: calculateUncertaintyRange(pos),
        }));

        const active = enriched.filter(p => p.status === 'ACTIVE').length;
        const closed = enriched.filter(p => p.status === 'CLOSED').length;

        return reply.send({
            success: true,
            data: {
                symbol,
                platform,
                totalRecords: enriched.length,
                activeCount: active,
                closedCount: closed,
                history: enriched,
            },
        });
    });

    // GET /signals/position-states/recently-closed - Recently closed positions across all traders
    fastify.get('/signals/position-states/recently-closed', async (
        request: FastifyRequest<{
            Querystring: { platform?: string; hoursAgo?: string; limit?: string };
        }>,
        reply: FastifyReply
    ) => {
        const platform = (request.query.platform as string) || 'binance';
        const hoursAgo = parseInt((request.query.hoursAgo as string) || '24', 10);
        const limit = parseInt((request.query.limit as string) || '100', 10);

        const positions = await getRecentlyClosedPositions(platform, hoursAgo, limit);

        // Add uncertainty ranges
        const enriched = positions.map(pos => ({
            ...pos,
            uncertaintyRange: calculateUncertaintyRange(pos),
            durationSeconds: pos.disappearedAt
                ? (pos.disappearedAt.getTime() - pos.firstSeenAt.getTime()) / 1000
                : null,
        }));

        // Calculate aggregate stats
        const totalDuration = enriched.reduce((sum, p) => sum + (p.durationSeconds || 0), 0);
        const avgDuration = enriched.length > 0 ? totalDuration / enriched.length : 0;
        const bySymbol = enriched.reduce((acc, p) => {
            acc[p.symbol] = (acc[p.symbol] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return reply.send({
            success: true,
            data: {
                platform,
                timeWindow: `${hoursAgo}h`,
                totalClosed: enriched.length,
                avgDurationSeconds: Math.round(avgDuration),
                topSymbols: Object.entries(bySymbol)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([symbol, count]) => ({ symbol, count })),
                positions: enriched,
            },
        });
    });
}

// Helper for feed endpoint
function getOrderAction(side: string, positionSide: string): string {
    if (side === 'BUY' && positionSide === 'LONG') return 'OPEN_LONG';
    if (side === 'SELL' && positionSide === 'LONG') return 'CLOSE_LONG';
    if (side === 'SELL' && positionSide === 'SHORT') return 'OPEN_SHORT';
    if (side === 'BUY' && positionSide === 'SHORT') return 'CLOSE_SHORT';
    return 'UNKNOWN';
}

// ────────────────────────────────────────────────────────────
// FAZ 0: Diagnostic builder
// ────────────────────────────────────────────────────────────

async function buildDiagnostic(leadId: string) {
    const [trader, score, latestIngest, eventCount30d, snapshotCount] = await Promise.all([
        prisma.leadTrader.findUnique({ where: { id: leadId } }),
        prisma.traderScore.findUnique({ where: { leadId } }),
        prisma.rawIngest.findFirst({
            where: { leadId },
            orderBy: { fetchedAt: 'desc' },
            select: { fetchedAt: true, payload: true, positionsCount: true, ordersCount: true },
        }),
        prisma.event.count({
            where: {
                leadId,
                eventTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
        }),
        prisma.positionSnapshot.count({ where: { leadId } }),
    ]);

    const now = Date.now();
    const issues: string[] = [];

    // Segment info
    const positionShow = trader?.positionShow ?? null;
    const posShowUpdatedAt = trader?.posShowUpdatedAt ?? null;
    let staleness = 'never_set';
    if (posShowUpdatedAt) {
        const ageMs = now - posShowUpdatedAt.getTime();
        if (ageMs < 60 * 60 * 1000) staleness = 'fresh';
        else if (ageMs < 24 * 60 * 60 * 1000) staleness = 'stale_1h';
        else staleness = 'stale_24h';
    }

    if (positionShow === null) issues.push('positionShow never set');
    if (staleness === 'stale_24h') issues.push('positionShow stale > 24h');

    // Data completeness
    const hasRawIngest = !!latestIngest;
    const ingestAgeMinutes = latestIngest
        ? Math.round((now - latestIngest.fetchedAt.getTime()) / 60000)
        : null;

    if (!hasRawIngest) issues.push('no raw ingest data');
    if (ingestAgeMinutes !== null && ingestAgeMinutes > 120) issues.push('stale ingest > 2h');
    if (eventCount30d === 0) issues.push('no events in 30d');
    if (snapshotCount === 0) issues.push('no position snapshots');

    const payload = latestIngest?.payload as Record<string, any> | null;
    const hasOrderHistory = (payload?.orderHistory?.allOrders?.length || 0) > 0;
    const orderCount = payload?.orderHistory?.allOrders?.length || 0;
    const hasRoiSeries = (payload?.roiSeries?.length || 0) > 0;
    const roiDataPoints = payload?.roiSeries?.length || 0;
    const hasPortfolioDetail = !!payload?.portfolioDetail;

    if (!hasOrderHistory) issues.push('no order history in payload');
    if (!hasPortfolioDetail) issues.push('no portfolio detail in payload');

    // Scoring
    let weightBreakdown: object | null = null;
    if (score?.qualityScore != null && score?.winRate != null) {
        const result = computeTraderWeight({
            qualityScore: score.qualityScore,
            confidence: (score.confidence as 'low' | 'medium' | 'high') ?? 'low',
            winRate: score.winRate,
            positionShow,
        });
        weightBreakdown = result.breakdown;
    }

    if (score?.traderWeight == null) issues.push('traderWeight not computed');

    return {
        leadId,
        nickname: trader?.nickname ?? null,
        segment: {
            positionShow,
            posShowUpdatedAt: posShowUpdatedAt?.toISOString() ?? null,
            staleness,
        },
        dataCompleteness: {
            hasRawIngest,
            latestIngestAt: latestIngest?.fetchedAt?.toISOString() ?? null,
            ingestAgeMinutes,
            hasPositionSnapshots: snapshotCount > 0,
            snapshotCount,
            hasEvents: eventCount30d > 0,
            eventCount30d,
            hasOrderHistory,
            orderCount,
            hasRoiSeries,
            roiDataPoints,
            hasPortfolioDetail,
        },
        scoring: {
            score30d: score?.score30d ?? null,
            qualityScore: score?.qualityScore ?? null,
            confidence: score?.confidence ?? null,
            winRate: score?.winRate ?? null,
            traderWeight: score?.traderWeight ?? null,
            weightBreakdown,
        },
        issues,
    };
}
