import { Position, TraderPayload } from '@/lib/api';

export interface DerivedTraderMetrics {
    activePositions: number;
    grossNotional: number;
    netExposure: number;
    unrealizedPnl: number;
    realizedPnl: number;
    avgLeverage: number;
    maxLeverage: number;
    adlHighCount: number;
    topSymbol: string | null;
    topSymbolShare: number;
    topAsset: string | null;
    topAssetShare: number;
    latestRoi: number | null;
    snapshotAgeMinutes: number | null;
    aumAmount: number | null;
    marginBalance: number | null;
    copierPnl: number | null;
    sharpeRatio: number | null;
    currentCopyCount: number | null;
    maxCopyCount: number | null;
    copyUtilization: number | null;
}

export interface RiskAlert {
    code: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
}

export interface RiskScore {
    score: number;
    band: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SnapshotPositionRef {
    key: string;
    symbol: string;
    side: string;
    leverage: number;
    notional: number;
}

export interface SnapshotLeverageChange {
    key: string;
    symbol: string;
    side: string;
    leverageBefore: number;
    leverageAfter: number;
    notionalBefore: number;
    notionalAfter: number;
}

export interface SnapshotDiff {
    snapshotGapMinutes: number | null;
    opened: SnapshotPositionRef[];
    closed: SnapshotPositionRef[];
    leverageChanges: SnapshotLeverageChange[];
    activePositionsDelta: number;
    orderCountDelta: number;
    unrealizedPnlDelta: number;
    realizedPnlDelta: number;
    roiDelta: number | null;
    copyCountDelta: number | null;
}

export function toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function toNonNullNumber(value: unknown, fallback = 0): number {
    const parsed = toNumber(value);
    return parsed === null ? fallback : parsed;
}

function positionKey(position: Position, index: number): string {
    if (position.id && String(position.id).trim().length > 0) {
        return String(position.id);
    }
    return `${position.symbol}|${position.positionSide}|${position.isolated ? 'ISO' : 'CROSS'}|${index}`;
}

function latestRoiValue(payload: TraderPayload): number | null {
    if (!Array.isArray(payload.roiSeries) || payload.roiSeries.length === 0) {
        return null;
    }

    const sorted = [...payload.roiSeries].sort((a, b) => {
        const ta = toNonNullNumber(a.dateTime);
        const tb = toNonNullNumber(b.dateTime);
        return ta - tb;
    });

    return toNumber(sorted[sorted.length - 1]?.value);
}

export function deriveTraderMetrics(payload: TraderPayload): DerivedTraderMetrics {
    const positions = Array.isArray(payload.activePositions) ? payload.activePositions : [];
    const orders = Array.isArray(payload.orderHistory?.allOrders) ? payload.orderHistory.allOrders : [];

    let grossNotional = 0;
    let netExposure = 0;
    let unrealizedPnl = 0;
    let leverageSum = 0;
    let maxLeverage = 0;
    let adlHighCount = 0;

    const symbolNotional = new Map<string, number>();

    positions.forEach((position) => {
        const notional = Math.abs(toNonNullNumber(position.notionalValue));
        const leverage = toNonNullNumber(position.leverage);
        const adl = toNonNullNumber(position.adl);
        const unrealized = toNonNullNumber(position.unrealizedProfit);

        const symbol = String(position.symbol || 'UNKNOWN');
        symbolNotional.set(symbol, (symbolNotional.get(symbol) || 0) + notional);

        grossNotional += notional;
        leverageSum += leverage;
        maxLeverage = Math.max(maxLeverage, leverage);
        unrealizedPnl += unrealized;

        if (adl >= 4) {
            adlHighCount += 1;
        }

        let direction = 0;
        if (position.positionSide === 'LONG') direction = 1;
        if (position.positionSide === 'SHORT') direction = -1;
        if (direction === 0) {
            const amount = toNonNullNumber(position.positionAmount);
            direction = amount === 0 ? 0 : amount > 0 ? 1 : -1;
        }

        netExposure += notional * direction;
    });

    let topSymbol: string | null = null;
    let topSymbolNotional = 0;
    symbolNotional.forEach((value, symbol) => {
        if (value > topSymbolNotional) {
            topSymbolNotional = value;
            topSymbol = symbol;
        }
    });

    const assetRows = Array.isArray(payload.assetPreferences?.data) ? payload.assetPreferences.data : [];
    let topAsset: string | null = null;
    let topAssetShare = 0;
    assetRows.forEach((row) => {
        const volume = toNonNullNumber(row.volume);
        if (volume > topAssetShare) {
            topAssetShare = volume;
            topAsset = row.asset;
        }
    });

    const realizedPnl = orders.reduce((sum, order) => sum + toNonNullNumber(order.totalPnl), 0);
    const snapshotAgeMinutes = Number.isNaN(Date.parse(payload.fetchedAt))
        ? null
        : Math.max(0, (Date.now() - Date.parse(payload.fetchedAt)) / (1000 * 60));

    const portfolio = payload.portfolioDetail as Record<string, unknown>;
    const currentCopyCount = toNumber(portfolio.currentCopyCount);
    const maxCopyCount = toNumber(portfolio.maxCopyCount);
    const copyUtilization =
        currentCopyCount !== null && maxCopyCount !== null && maxCopyCount > 0
            ? currentCopyCount / maxCopyCount
            : null;

    return {
        activePositions: positions.length,
        grossNotional,
        netExposure,
        unrealizedPnl,
        realizedPnl,
        avgLeverage: positions.length > 0 ? leverageSum / positions.length : 0,
        maxLeverage,
        adlHighCount,
        topSymbol,
        topSymbolShare: grossNotional > 0 ? (topSymbolNotional / grossNotional) * 100 : 0,
        topAsset,
        topAssetShare,
        latestRoi: latestRoiValue(payload),
        snapshotAgeMinutes,
        aumAmount: toNumber(portfolio.aumAmount),
        marginBalance: toNumber(portfolio.marginBalance),
        copierPnl: toNumber(portfolio.copierPnl),
        sharpeRatio: toNumber(portfolio.sharpRatio),
        currentCopyCount,
        maxCopyCount,
        copyUtilization,
    };
}

export function buildRiskAlerts(payload: TraderPayload, metrics: DerivedTraderMetrics): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    if (metrics.maxLeverage >= 80) {
        alerts.push({
            code: 'extreme_leverage',
            severity: 'high',
            title: 'Extreme leverage',
            detail: `Max leverage is ${metrics.maxLeverage.toFixed(0)}x.`,
        });
    } else if (metrics.maxLeverage >= 50) {
        alerts.push({
            code: 'high_leverage',
            severity: 'medium',
            title: 'High leverage',
            detail: `Max leverage is ${metrics.maxLeverage.toFixed(0)}x.`,
        });
    }

    if (metrics.topSymbolShare >= 70) {
        alerts.push({
            code: 'symbol_concentration_high',
            severity: 'high',
            title: 'Symbol concentration',
            detail: `${metrics.topSymbol || 'Top symbol'} is ${metrics.topSymbolShare.toFixed(1)}% of notional.`,
        });
    } else if (metrics.topSymbolShare >= 50) {
        alerts.push({
            code: 'symbol_concentration_medium',
            severity: 'medium',
            title: 'Symbol concentration',
            detail: `${metrics.topSymbol || 'Top symbol'} is ${metrics.topSymbolShare.toFixed(1)}% of notional.`,
        });
    }

    if (metrics.topAssetShare >= 60) {
        alerts.push({
            code: 'asset_concentration',
            severity: 'medium',
            title: 'Asset concentration',
            detail: `${metrics.topAsset || 'Top asset'} weight is ${metrics.topAssetShare.toFixed(1)}%.`,
        });
    }

    if (metrics.adlHighCount >= 2) {
        alerts.push({
            code: 'adl_pressure_high',
            severity: 'high',
            title: 'ADL pressure',
            detail: `${metrics.adlHighCount} position(s) have ADL >= 4.`,
        });
    } else if (metrics.adlHighCount >= 1) {
        alerts.push({
            code: 'adl_pressure',
            severity: 'medium',
            title: 'ADL pressure',
            detail: `${metrics.adlHighCount} position(s) have ADL >= 4.`,
        });
    }

    if (metrics.marginBalance !== null && metrics.marginBalance > 0) {
        const unrealizedRatio = metrics.unrealizedPnl / metrics.marginBalance;
        if (unrealizedRatio <= -0.15) {
            alerts.push({
                code: 'unrealized_drawdown_high',
                severity: 'high',
                title: 'Large unrealized drawdown',
                detail: `Unrealized PnL is ${(unrealizedRatio * 100).toFixed(1)}% of margin balance.`,
            });
        } else if (unrealizedRatio <= -0.05) {
            alerts.push({
                code: 'unrealized_drawdown',
                severity: 'medium',
                title: 'Unrealized drawdown',
                detail: `Unrealized PnL is ${(unrealizedRatio * 100).toFixed(1)}% of margin balance.`,
            });
        }
    }

    if (metrics.copyUtilization !== null) {
        if (metrics.copyUtilization >= 0.98) {
            alerts.push({
                code: 'copy_capacity_near_full',
                severity: 'high',
                title: 'Copy capacity nearly full',
                detail: `Copy slots are ${(metrics.copyUtilization * 100).toFixed(1)}% utilized.`,
            });
        } else if (metrics.copyUtilization >= 0.9) {
            alerts.push({
                code: 'copy_capacity_high',
                severity: 'medium',
                title: 'Copy capacity high',
                detail: `Copy slots are ${(metrics.copyUtilization * 100).toFixed(1)}% utilized.`,
            });
        }
    }

    if (metrics.snapshotAgeMinutes !== null) {
        if (metrics.snapshotAgeMinutes > 15) {
            alerts.push({
                code: 'stale_snapshot_high',
                severity: 'high',
                title: 'Snapshot is stale',
                detail: `Snapshot age is ${metrics.snapshotAgeMinutes.toFixed(1)} minutes.`,
            });
        } else if (metrics.snapshotAgeMinutes > 5) {
            alerts.push({
                code: 'stale_snapshot',
                severity: 'low',
                title: 'Snapshot is getting old',
                detail: `Snapshot age is ${metrics.snapshotAgeMinutes.toFixed(1)} minutes.`,
            });
        }
    }

    if (Math.abs(metrics.netExposure) > metrics.grossNotional * 0.9 && metrics.grossNotional > 0) {
        alerts.push({
            code: 'directional_exposure',
            severity: 'low',
            title: 'Directional exposure',
            detail: 'Portfolio is strongly one-sided in net exposure.',
        });
    }

    if (Array.isArray(payload.activePositions) && payload.activePositions.length === 0) {
        alerts.push({
            code: 'no_open_positions',
            severity: 'low',
            title: 'No active positions',
            detail: 'Current snapshot has no open positions.',
        });
    }

    return alerts;
}

export function buildRiskScore(alerts: RiskAlert[]): RiskScore {
    const penalty = alerts.reduce((sum, alert) => {
        if (alert.severity === 'high') return sum + 25;
        if (alert.severity === 'medium') return sum + 12;
        return sum + 6;
    }, 0);

    const score = Math.max(0, 100 - penalty);
    let band: RiskScore['band'] = 'LOW';
    if (score < 40) band = 'HIGH';
    else if (score < 70) band = 'MEDIUM';

    return { score, band };
}

export function buildSnapshotDiff(current: TraderPayload, previous: TraderPayload): SnapshotDiff {
    const currentPositions = Array.isArray(current.activePositions) ? current.activePositions : [];
    const previousPositions = Array.isArray(previous.activePositions) ? previous.activePositions : [];

    const currentMap = new Map<string, SnapshotPositionRef>();
    const previousMap = new Map<string, SnapshotPositionRef>();

    currentPositions.forEach((position, index) => {
        const key = positionKey(position, index);
        currentMap.set(key, {
            key,
            symbol: String(position.symbol || 'UNKNOWN'),
            side: String(position.positionSide || 'BOTH'),
            leverage: toNonNullNumber(position.leverage),
            notional: Math.abs(toNonNullNumber(position.notionalValue)),
        });
    });

    previousPositions.forEach((position, index) => {
        const key = positionKey(position, index);
        previousMap.set(key, {
            key,
            symbol: String(position.symbol || 'UNKNOWN'),
            side: String(position.positionSide || 'BOTH'),
            leverage: toNonNullNumber(position.leverage),
            notional: Math.abs(toNonNullNumber(position.notionalValue)),
        });
    });

    const opened: SnapshotPositionRef[] = [];
    const closed: SnapshotPositionRef[] = [];
    const leverageChanges: SnapshotLeverageChange[] = [];

    currentMap.forEach((currentPosition, key) => {
        const previousPosition = previousMap.get(key);
        if (!previousPosition) {
            opened.push(currentPosition);
            return;
        }

        if (Math.abs(currentPosition.leverage - previousPosition.leverage) > 0.00001) {
            leverageChanges.push({
                key,
                symbol: currentPosition.symbol,
                side: currentPosition.side,
                leverageBefore: previousPosition.leverage,
                leverageAfter: currentPosition.leverage,
                notionalBefore: previousPosition.notional,
                notionalAfter: currentPosition.notional,
            });
        }
    });

    previousMap.forEach((previousPosition, key) => {
        if (!currentMap.has(key)) {
            closed.push(previousPosition);
        }
    });

    const currentMetrics = deriveTraderMetrics(current);
    const previousMetrics = deriveTraderMetrics(previous);

    const currentOrderCount = Array.isArray(current.orderHistory?.allOrders) ? current.orderHistory.allOrders.length : 0;
    const previousOrderCount = Array.isArray(previous.orderHistory?.allOrders) ? previous.orderHistory.allOrders.length : 0;

    const gapMinutes =
        Number.isNaN(Date.parse(current.fetchedAt)) || Number.isNaN(Date.parse(previous.fetchedAt))
            ? null
            : Math.abs(Date.parse(current.fetchedAt) - Date.parse(previous.fetchedAt)) / (1000 * 60);

    const currentCopy = toNumber((current.portfolioDetail as Record<string, unknown>).currentCopyCount);
    const previousCopy = toNumber((previous.portfolioDetail as Record<string, unknown>).currentCopyCount);

    return {
        snapshotGapMinutes: gapMinutes,
        opened,
        closed,
        leverageChanges,
        activePositionsDelta: currentMetrics.activePositions - previousMetrics.activePositions,
        orderCountDelta: currentOrderCount - previousOrderCount,
        unrealizedPnlDelta: currentMetrics.unrealizedPnl - previousMetrics.unrealizedPnl,
        realizedPnlDelta: currentMetrics.realizedPnl - previousMetrics.realizedPnl,
        roiDelta:
            currentMetrics.latestRoi !== null && previousMetrics.latestRoi !== null
                ? currentMetrics.latestRoi - previousMetrics.latestRoi
                : null,
        copyCountDelta:
            currentCopy !== null && previousCopy !== null
                ? currentCopy - previousCopy
                : null,
    };
}
