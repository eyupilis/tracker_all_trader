// API Client for Copy Trading Backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'dev-api-key-12345';

interface ApiOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body } = options;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// Types
export interface RawIngest {
    id: string;
    leadId: string;
    fetchedAt: string;
    positionsCount: number | null;
    ordersCount: number | null;
    timeRange: string | null;
    createdAt: string;
    payload?: TraderPayload;
}

export interface TraderPayload {
    leadId: string;
    fetchedAt: string;
    timeRange: string;
    startTime: number;
    endTime: number;
    leadCommon: LeadCommon;
    portfolioDetail: PortfolioDetail;
    roiSeries: RoiDataPoint[];
    assetPreferences: AssetPreferences;
    activePositions: Position[];
    orderHistory: OrderHistory;
    positionAudit?: PositionAudit;
    [key: string]: unknown;
}

export interface PositionAudit {
    sourceRawPositionsCount?: number;
    filteredActivePositionsCount?: number;
    droppedPositionsCount?: number;
    nonZeroByAmountCount?: number;
    nonZeroByNotionalCount?: number;
    nonZeroByUnrealizedCount?: number;
    droppedBecauseAllZeroCount?: number;
    [key: string]: unknown;
}

export interface LeadCommon {
    leadOwner: boolean;
    futuresPrivateLPId?: string;
    futuresPrivateLPStatus?: string;
    futuresPublicLPId: string;
    futuresPublicLPStatus: string;
    spotPrivateLPId?: string;
    spotPrivateLPStatus?: string;
    spotPublicLPId?: string;
    spotPublicLPStatus?: string;
}

export interface TagItemVo {
    tagName: string;
    tagLangKey: string;
    descLangKey: string;
    describeParams: Record<string, string>;
    enDescribe: string | null;
    cnDescribe: string | null;
    sort: number;
    tagLangKeyMessage: string | null;
    descLangKeyMessage: string | null;
}

export interface PortfolioDetail {
    // Basic Info
    nickname: string;
    avatarUrl: string;
    description: string;
    descTranslate: string | null;
    nicknameTranslate: string | null;
    badgeName: string;
    status: string;
    futuresType: string;
    portfolioType: string;
    pgcUsername: string | null;
    userId: string | null;

    // Portfolio IDs
    leadPortfolioId: string;
    publicLeadPortfolioId: string;
    privateLeadPortfolioId: string | null;

    // Financial Metrics
    marginBalance: number | string;
    aumAmount: number | string;
    copierPnl: number | string;
    copierPnlAsset: string;
    profitSharingRate: number | string;
    sharpRatio: number | string;
    rebateFee: number | string;
    unrealizedProfitShareAmount: number | string;
    initInvestAsset: string;

    // Copier Stats
    currentCopyCount: number;
    maxCopyCount: number;
    totalCopyCount: number;
    mockCopyCount: number;
    favoriteCount: number;
    badgeCopierCount: number;
    enableAddMaxCopier: boolean;
    finalEffectiveMaxCopyCount: number | null;
    riskControlMaxCopyCount: number | null;

    // Copy Settings
    fixedAmountMinCopyUsd: number;
    fixedRadioMinCopyUsd: number;
    lockPeriod: number;
    copierLockPeriodTime: number | null;
    copierUnlockExpiredTime: number | null;

    // Timestamps
    lastTradeTime: number;
    startTime: number;
    closedTime: number | null;
    endTime: number | null;
    badgeModifyTime: number | null;

    // Settings & Flags
    tag: string[];
    tagItemVos: TagItemVo[];
    positionShow: boolean;
    closeLeadCount: number;
    syncSettingCount: number;
    syncSetting: boolean;
    inviteCodeCount: number;
    enableTradingSignal: boolean;
    feedAgreement: boolean;
    feedShareSwitch: boolean;
    feedSharePushLimit: number;

    // User state flags
    favorite: boolean;
    hasCopy: boolean;
    hasMock: boolean;
    hasSlotReminder: boolean;
    leadOwner: boolean;

    // Extended fields from raw payload
    [key: string]: unknown;
}

export interface RoiDataPoint {
    value: number;
    dataType: string;
    dateTime: number;
}

export interface AssetPreferences {
    data: { asset: string; volume: number }[];
    timeRange: string;
    updateTime: number;
}

export interface Position {
    id: string;
    symbol: string;
    collateral: string;
    positionAmount: string | number;
    entryPrice: string | number;
    markPrice: string | number;
    leverage: number;
    isolated: boolean;
    isolatedWallet: string | number;
    positionSide: 'LONG' | 'SHORT' | 'BOTH';
    unrealizedProfit: string | number;
    cumRealized: string | number;
    notionalValue: string | number;
    askNotional: string | number;
    bidNotional: string | number;
    breakEvenPrice: string | number;
    adl: number;
}

export interface Order {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    side: 'BUY' | 'SELL';
    type: string;
    positionSide: 'LONG' | 'SHORT' | 'BOTH';
    origQty?: number;
    executedQty: number;
    avgPrice: number;
    totalPnl: number;
    orderTime: number;
    orderUpdateTime: number;
}

export interface OrderHistory {
    total: number;
    allOrders: Order[];
}

// API Functions
export async function getLatestIngests(limit = 20): Promise<{ success: boolean; data: RawIngest[] }> {
    return apiRequest(`/ingest/raw/latest?limit=${limit}`);
}

export async function getTraderData(
    leadId: string,
    includePayload = true,
    limit = 1
): Promise<{ success: boolean; data: RawIngest[]; meta: { total: number; leadId: string } }> {
    return apiRequest(`/ingest/raw/${leadId}?includePayload=${includePayload}&limit=${limit}`);
}

export async function getUniqueTraders(): Promise<string[]> {
    const response = await getLatestIngests(100);
    const traders = new Set(response.data.map((item) => item.leadId));
    return Array.from(traders);
}

export async function getHealthStatus(): Promise<{ status: string; timestamp: string }> {
    return apiRequest('/health');
}

// Signals API Types
export type ConsensusDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface HeatMapTrader {
    leadId: string;
    nickname: string;
    side: 'LONG' | 'SHORT';
    leverage: number;
    traderWeight: number | null;
    entryPrice: number;
    isDerived?: boolean;
    derivedConfidence?: number | null;
}

export interface HeatMapData {
    symbol: string;
    longCount: number;
    shortCount: number;
    totalTraders: number;
    avgLeverage: number;
    weightedAvgLeverage: number;
    totalVolume: number;
    longVolume: number;
    shortVolume: number;
    imbalance: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    // FAZ 1: consensus fields
    sentimentScore: number;         // -1..+1
    consensusDirection: ConsensusDirection;
    confidenceScore: number;        // 0..100
    sumWeights: number;
    derivedConfidenceAvg?: number | null;
    dataSource?: 'VISIBLE' | 'HIDDEN_DERIVED' | 'MIXED';
    visibleTraderCount?: number;
    hiddenTraderCount?: number;
    topTraders: HeatMapTrader[];
}

export interface SymbolDetailTrader {
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
    traderWeight: number | null;
    segment: TraderSegment | null;
    qualityScore: number | null;
    confidence: 'low' | 'medium' | 'high' | null;
    winRate: number | null;
    isDerived?: boolean;
    derivedConfidence?: number | null;
    lastAction?: string | null;
}

export interface SymbolDetail {
    symbol: string;
    summary: {
        longCount: number;
        shortCount: number;
        totalTraders: number;
        totalLongVolume: number;
        totalShortVolume: number;
        avgEntryLong: number;
        avgEntryShort: number;
        weightedAvgEntryLong: number;
        weightedAvgEntryShort: number;
        sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        sentimentScore: number;
        consensusDirection: ConsensusDirection;
        confidenceScore: number;
        sumWeights: number;
        derivedConfidenceAvg?: number | null;
    };
    traders: SymbolDetailTrader[];
}

export interface SignalsFilters {
    timeRange?: string;
    side?: string;
    leverage?: string;
    minTraders?: string;
    segment?: 'VISIBLE' | 'HIDDEN' | 'BOTH';
}

export interface SignalsFeedItem {
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
    segment: TraderSegment;
    traderWeight: number | null;
    qualityScore: number | null;
    confidence: 'low' | 'medium' | 'high' | null;
    winRate: number | null;
}

export interface SignalsFeedFilters {
    source?: 'all' | 'positions' | 'derived';
    limit?: number;
    symbol?: string;
    timeRange?: string;
    segment?: 'VISIBLE' | 'HIDDEN' | 'BOTH';
}

// Signals API Functions
export async function getHeatMapData(filters: SignalsFilters = {}): Promise<{
    success: boolean;
    data: HeatMapData[];
    meta: { totalSymbols: number; totalTraders: number; filters: SignalsFilters };
}> {
    const params = new URLSearchParams();
    if (filters.timeRange) params.set('timeRange', filters.timeRange);
    if (filters.side) params.set('side', filters.side);
    if (filters.leverage) params.set('leverage', filters.leverage);
    if (filters.minTraders) params.set('minTraders', filters.minTraders);
    if (filters.segment) params.set('segment', filters.segment);

    return apiRequest(`/signals/heatmap?${params.toString()}`);
}

export async function getSymbolDetail(
    symbol: string,
    timeRange = '24h',
    segment: 'VISIBLE' | 'HIDDEN' | 'BOTH' = 'BOTH',
): Promise<{
    success: boolean;
    data: SymbolDetail;
    meta: { timeRange: string; segment?: string };
}> {
    return apiRequest(`/signals/symbol/${symbol}?timeRange=${timeRange}&segment=${segment}`);
}

export async function getSignalsFeed(filters: SignalsFeedFilters = {}): Promise<{
    success: boolean;
    data: SignalsFeedItem[];
    meta: { total: number; returned: number; source: string; symbol: string | null; timeRange: string; segment?: string };
}> {
    const params = new URLSearchParams();
    if (filters.source) params.set('source', filters.source);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.symbol) params.set('symbol', filters.symbol);
    if (filters.timeRange) params.set('timeRange', filters.timeRange);
    if (filters.segment) params.set('segment', filters.segment);
    const query = params.toString();
    return apiRequest(`/signals/feed${query ? `?${query}` : ''}`);
}

export interface SimulatedPosition {
    id: string;
    platform: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    status: 'OPEN' | 'CLOSED';
    leverage: number;
    marginNotional: number;
    positionNotional: number;
    entryPrice: number;
    exitPrice: number | null;
    pnlUSDT: number | null;
    roiPct: number | null;
    source: string;
    closeReason: string | null;
    closeTriggerLeadId: string | null;
    closeTriggerEventType: string | null;
    notes: string | null;
    openedAt: string;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SimulationReport {
    totals: {
        all: number;
        open: number;
        closed: number;
        wins: number;
        losses: number;
        breakeven: number;
        winRate: number;
        totalPnl: number;
        avgPnl: number;
        avgRoiPct: number;
    };
    bySymbol: Array<{
        symbol: string;
        trades: number;
        totalPnl: number;
        winRate: number;
    }>;
    recentClosed: SimulatedPosition[];
}

export async function openSimulationPosition(payload: {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    leverage?: number;
    notional?: number;
    entryPrice?: number;
    notes?: string;
}): Promise<{ success: boolean; data: SimulatedPosition }> {
    return apiRequest('/signals/simulation/open', { method: 'POST', body: payload });
}

export async function closeSimulationPosition(
    id: string,
    payload: { exitPrice?: number; reason?: string } = {},
): Promise<{ success: boolean; data: SimulatedPosition }> {
    return apiRequest(`/signals/simulation/${id}/close`, { method: 'POST', body: payload });
}

export async function reconcileSimulationPositions(): Promise<{
    success: boolean;
    data: { closedCount: number; closed: SimulatedPosition[] };
}> {
    return apiRequest('/signals/simulation/reconcile', { method: 'POST', body: {} });
}

export async function getSimulationPositions(
    status: 'OPEN' | 'CLOSED' | 'ALL' = 'ALL',
    limit = 100,
    reconcile = false,
): Promise<{ success: boolean; data: SimulatedPosition[]; meta: { status: string; returned: number; reconcile: boolean } }> {
    const params = new URLSearchParams();
    params.set('status', status);
    params.set('limit', String(limit));
    if (reconcile) params.set('reconcile', 'true');
    return apiRequest(`/signals/simulation/positions?${params.toString()}`);
}

export async function getSimulationReport(): Promise<{ success: boolean; data: SimulationReport }> {
    return apiRequest('/signals/simulation/report');
}

export type SimulationSegment = 'VISIBLE' | 'HIDDEN' | 'BOTH';
export type SignalsTimeRange = '1h' | '4h' | '24h' | '7d' | 'ALL';

export interface AutoTriggerRule {
    id: string;
    platform: string;
    enabled: boolean;
    segment: SimulationSegment;
    timeRange: SignalsTimeRange;
    minTraders: number;
    minConfidence: number;
    minSentimentAbs: number;
    leverage: number;
    marginNotional: number;
    cooldownMinutes: number;
    lastRunAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AutoRunCandidate {
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

export interface AutoRunSkip {
    symbol: string;
    reason: string;
}

export interface AutoRunResult {
    rule: AutoTriggerRule;
    reconciledCount: number;
    openedCount: number;
    closedCount: number;
    skippedCount: number;
    opened: Array<Record<string, unknown>>;
    closed: Array<Record<string, unknown>>;
    skipped: AutoRunSkip[];
    candidates: AutoRunCandidate[];
    status?: string;
}

export interface BacktestLiteTrade {
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
}

export interface BacktestLiteResult {
    config: {
        timeRange: SignalsTimeRange;
        segmentFilter: SimulationSegment;
        minTraders: number;
        minConfidence: number;
        minSentimentAbs: number;
        leverage: number;
        marginNotional: number;
        startTime: string;
    };
    summary: {
        trades: number;
        wins: number;
        losses: number;
        breakeven: number;
        winRate: number;
        totalPnl: number;
        avgPnl: number;
        avgRoiPct: number;
    };
    bySymbol: Array<{
        symbol: string;
        trades: number;
        totalPnl: number;
        winRate: number;
    }>;
    trades: BacktestLiteTrade[];
}

export interface AutoRuleUpdatePayload {
    enabled?: boolean;
    segment?: SimulationSegment;
    timeRange?: SignalsTimeRange;
    minTraders?: number;
    minConfidence?: number;
    minSentimentAbs?: number;
    leverage?: number;
    marginNotional?: number;
    cooldownMinutes?: number;
}

export interface BacktestLiteQueryParams {
    timeRange?: SignalsTimeRange;
    segment?: SimulationSegment;
    minTraders?: number;
    minConfidence?: number;
    minSentimentAbs?: number;
    leverage?: number;
    marginNotional?: number;
}

export async function getAutoTriggerRule(): Promise<{ success: boolean; data: AutoTriggerRule }> {
    return apiRequest('/signals/simulation/auto-rule');
}

export async function updateAutoTriggerRule(payload: AutoRuleUpdatePayload): Promise<{
    success: boolean;
    data: AutoTriggerRule;
    meta: { updated: boolean };
}> {
    return apiRequest('/signals/simulation/auto-rule', { method: 'PUT', body: payload });
}

export async function runAutoSimulation(dryRun = false): Promise<{ success: boolean; data: AutoRunResult }> {
    const params = new URLSearchParams();
    if (dryRun) params.set('dryRun', 'true');
    const query = params.toString();
    return apiRequest(`/signals/simulation/auto-run${query ? `?${query}` : ''}`, { method: 'POST', body: {} });
}

export async function getBacktestLite(params: BacktestLiteQueryParams = {}): Promise<{ success: boolean; data: BacktestLiteResult }> {
    const query = new URLSearchParams();
    if (params.timeRange) query.set('timeRange', params.timeRange);
    if (params.segment) query.set('segment', params.segment);
    if (typeof params.minTraders === 'number') query.set('minTraders', String(params.minTraders));
    if (typeof params.minConfidence === 'number') query.set('minConfidence', String(params.minConfidence));
    if (typeof params.minSentimentAbs === 'number') query.set('minSentimentAbs', String(params.minSentimentAbs));
    if (typeof params.leverage === 'number') query.set('leverage', String(params.leverage));
    if (typeof params.marginNotional === 'number') query.set('marginNotional', String(params.marginNotional));
    const queryString = query.toString();
    return apiRequest(`/signals/simulation/backtest-lite${queryString ? `?${queryString}` : ''}`);
}

export type InsightSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface InsightAnomaly {
    type: string;
    severity: InsightSeverity;
    symbol: string;
    message: string;
    metric: string;
    value: number;
}

export interface InsightStabilityRow {
    symbol: string;
    updates: number;
    flips: number;
    flipRate: number;
    stabilityScore: number;
    lastDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
}

export interface InsightLeaderboardRow {
    rank: number;
    leadId: string;
    nickname: string;
    segment: TraderSegment;
    traderWeight: number;
    qualityScore: number | null;
    confidence: 'low' | 'medium' | 'high' | null;
    winRate: number | null;
    activityEvents: number;
    avgLeverage: number;
    realizedPnl: number;
    score: number;
}

export interface SignalsInsights {
    generatedAt: string;
    filters: {
        timeRange: SignalsTimeRange;
        segment: SimulationSegment;
        top: number;
        mode: InsightsMode;
    };
    riskOverview: {
        score: number;
        level: InsightSeverity;
        crowdedSymbols: number;
        highLeverageSymbols: number;
        unstableSymbols: number;
        lowConfidenceSymbols: number;
    };
    anomalies: InsightAnomaly[];
    stability: InsightStabilityRow[];
    leaderboard: InsightLeaderboardRow[];
}

export interface SignalsInsightsQuery {
    timeRange?: SignalsTimeRange;
    segment?: SimulationSegment;
    top?: number;
    mode?: InsightsMode;
}

export type InsightsMode = 'conservative' | 'balanced' | 'aggressive';

export interface InsightsPresetConfig {
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

export interface InsightsRule {
    id: string;
    platform: string;
    defaultMode: InsightsMode;
    presets: {
        conservative: InsightsPresetConfig;
        balanced: InsightsPresetConfig;
        aggressive: InsightsPresetConfig;
    };
    createdAt: string;
    updatedAt: string;
}

export interface InsightsRuleUpdatePayload {
    defaultMode?: InsightsMode;
    presets?: {
        conservative?: Partial<InsightsPresetConfig>;
        balanced?: Partial<InsightsPresetConfig>;
        aggressive?: Partial<InsightsPresetConfig>;
    };
}

export async function getSignalsInsights(params: SignalsInsightsQuery = {}): Promise<{
    success: boolean;
    data: SignalsInsights;
    meta: { timeRange: SignalsTimeRange; segment: SimulationSegment; top: number; mode: InsightsMode; defaultMode?: InsightsMode };
}> {
    const query = new URLSearchParams();
    if (params.timeRange) query.set('timeRange', params.timeRange);
    if (params.segment) query.set('segment', params.segment);
    if (typeof params.top === 'number') query.set('top', String(params.top));
    if (params.mode) query.set('mode', params.mode);
    const queryString = query.toString();
    return apiRequest(`/signals/insights${queryString ? `?${queryString}` : ''}`);
}

export async function getInsightsRule(): Promise<{ success: boolean; data: InsightsRule }> {
    return apiRequest('/signals/insights/rule');
}

export async function updateInsightsRule(payload: InsightsRuleUpdatePayload): Promise<{
    success: boolean;
    data: InsightsRule;
    meta: { updated: boolean };
}> {
    return apiRequest('/signals/insights/rule', { method: 'PUT', body: payload });
}

// Performance data (fetched directly from Binance for real-time stats)
export interface PerformanceData {
    timeRange: string;
    roi: number;
    pnl: number;
    mdd: number;
    copierPnl: number;
    winRate: number;
    winOrders: number;
    totalOrder: number;
    sharpRatio: number;
}

export async function getTraderPerformance(leadId: string, timeRange = '30D'): Promise<PerformanceData | null> {
    try {
        const res = await fetch(
            `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance?portfolioId=${leadId}&timeRange=${timeRange}`,
            { next: { revalidate: 60 } }
        );
        const json = await res.json();
        if (json.success && json.data) {
            return json.data as PerformanceData;
        }
        return null;
    } catch {
        return null;
    }
}

export type TimeRange = '7D' | '30D' | '90D';
export const TIME_RANGES: TimeRange[] = ['7D', '30D', '90D'];

export interface MultiRangePerformance {
    '7D': PerformanceData | null;
    '30D': PerformanceData | null;
    '90D': PerformanceData | null;
}

export async function getTraderPerformanceMulti(leadId: string): Promise<MultiRangePerformance> {
    const [d7, d30, d90] = await Promise.all(
        TIME_RANGES.map((r) => getTraderPerformance(leadId, r))
    );
    return { '7D': d7, '30D': d30, '90D': d90 };
}

// Fetch portfolio detail directly from Binance API
export async function getTraderPortfolio(leadId: string): Promise<PortfolioDetail | null> {
    try {
        const res = await fetch(
            `https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/detail?portfolioId=${leadId}`,
            { next: { revalidate: 60 } }
        );
        const json = await res.json();
        if (json.success && json.data) {
            return json.data as PortfolioDetail;
        }
        return null;
    } catch {
        return null;
    }
}

// Fetch active positions directly from Binance API
export async function getTraderPositions(leadId: string): Promise<Position[]> {
    try {
        const res = await fetch(
            `https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/positions?portfolioId=${leadId}`,
            { next: { revalidate: 60 } }
        );
        const json = await res.json();
        if (json.success && json.data) {
            return json.data as Position[];
        }
        return [];
    } catch {
        return [];
    }
}

// ────────────────────────────────────────────────────────────
// FAZ 0: Diagnostic types + API functions
// ────────────────────────────────────────────────────────────

export type TraderSegment = 'VISIBLE' | 'HIDDEN' | 'UNKNOWN';

export interface TraderDiagnostic {
    leadId: string;
    nickname: string | null;
    segment: {
        positionShow: boolean | null;
        posShowUpdatedAt: string | null;
        staleness: 'fresh' | 'stale_1h' | 'stale_24h' | 'never_set';
    };
    dataCompleteness: {
        hasRawIngest: boolean;
        latestIngestAt: string | null;
        ingestAgeMinutes: number | null;
        hasPositionSnapshots: boolean;
        snapshotCount: number;
        hasEvents: boolean;
        eventCount30d: number;
        hasOrderHistory: boolean;
        orderCount: number;
        hasRoiSeries: boolean;
        roiDataPoints: number;
        hasPortfolioDetail: boolean;
    };
    scoring: {
        score30d: number | null;
        qualityScore: number | null;
        confidence: string | null;
        winRate: number | null;
        traderWeight: number | null;
        weightBreakdown: {
            baseWeight: number;
            confidenceFactor: number;
            winAdj: number;
            availabilityPenalty: number;
        } | null;
    };
    issues: string[];
}

export interface DiagnosticSummary {
    traders: TraderDiagnostic[];
    summary: {
        totalTraders: number;
        visibleTraders: number;
        hiddenTraders: number;
        unknownSegment: number;
        tradersWithIssues: number;
        averageWeight: number;
        readyForConsensus: boolean;
    };
}

export async function getDiagnostics(): Promise<{ success: boolean; data: DiagnosticSummary }> {
    return apiRequest('/signals/diagnostic');
}

export async function getTraderDiagnostic(leadId: string): Promise<{ success: boolean; data: TraderDiagnostic }> {
    return apiRequest(`/signals/diagnostic/${leadId}`);
}

// Utility functions
export function formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';

    if (Math.abs(num) >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    }
    if (Math.abs(num) >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

// Format crypto prices with proper precision
export function formatPrice(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return '0.00';

    // For very small numbers (< 0.01), show up to 8 significant decimals
    if (Math.abs(num) < 0.01) {
        // Find first non-zero digit after decimal point
        const str = num.toFixed(10);
        const match = str.match(/0\.0*[1-9]/);
        if (match) {
            const zerosAfterDecimal = match[0].length - 2; // subtract "0."
            return num.toFixed(Math.min(zerosAfterDecimal + 4, 8));
        }
        return num.toFixed(8);
    }
    // For small numbers (< 1), show 4 decimals
    if (Math.abs(num) < 1) {
        return num.toFixed(4);
    }
    // For normal numbers, show 2 decimals
    return num.toFixed(2);
}

export function formatPnl(value: number | string | null | undefined): { text: string; color: string } {
    if (value === null || value === undefined) return { text: '-', color: 'text-gray-500' };
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return { text: '-', color: 'text-gray-500' };

    const color = num >= 0 ? 'text-green-500' : 'text-red-500';
    const prefix = num >= 0 ? '+' : '';
    return { text: `${prefix}${formatNumber(num)}`, color };
}

// ── Latest Records (order-history from Binance, displayed as timeline) ──
export interface LatestRecord {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    side: 'BUY' | 'SELL';
    type: string;
    positionSide: 'LONG' | 'SHORT' | 'BOTH';
    executedQty: number;
    avgPrice: number;
    totalPnl: number;
    orderUpdateTime: number;
    orderTime: number;
    origQty?: number;
}

export async function getTraderLatestRecords(
    leadId: string,
    pageNumber = 1,
    pageSize = 20
): Promise<{ list: LatestRecord[]; total: number }> {
    try {
        const res = await fetch(
            'https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-portfolio/order-history',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolioId: leadId, pageNumber, pageSize }),
                next: { revalidate: 60 },
            }
        );
        const json = await res.json();
        if (json.success && json.data) {
            return { list: json.data.list || [], total: json.data.total || 0 };
        }
        return { list: [], total: 0 };
    } catch {
        return { list: [], total: 0 };
    }
}

// ── Position History (closed position summaries from Binance) ──
export interface PositionHistoryRecord {
    id: number;
    symbol: string;
    type: string;
    opened: number;
    closed: number;
    avgCost: number;
    avgClosePrice: number;
    closingPnl: number;
    maxOpenInterest: number;
    closedVolume: number;
    isolated: string;
    side: string;
    status: string;
    updateTime: number;
}

export async function getTraderPositionHistory(
    leadId: string,
    pageNumber = 1,
    pageSize = 20
): Promise<{ list: PositionHistoryRecord[]; total: number }> {
    try {
        const res = await fetch(
            'https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/position-history',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolioId: leadId, pageNumber, pageSize }),
                next: { revalidate: 60 },
            }
        );
        const json = await res.json();
        if (json.success && json.data) {
            return { list: json.data.list || [], total: json.data.total || 0 };
        }
        return { list: [], total: 0 };
    } catch {
        return { list: [], total: 0 };
    }
}

export function formatDate(timestamp: number | string): string {
    const date = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp));
    return date.toLocaleString('tr-TR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
