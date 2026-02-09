/**
 * Derived Feed Service
 * 
 * When activePositions is empty/hidden (privacy), derive signals from orderHistory.
 * This allows tracking trader behavior even when positions are not visible.
 */

export interface DerivedSignal {
    leadId: string;
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    action: 'OPEN_LONG' | 'CLOSE_LONG' | 'OPEN_SHORT' | 'CLOSE_SHORT';
    notional: number;
    executedQty: number;
    avgPrice: number;
    realizedPnl: number;
    timestamp: number;
    source: 'DERIVED';
}

export interface Order {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    side: 'BUY' | 'SELL';
    type: string;
    positionSide: 'LONG' | 'SHORT';
    executedQty: number;
    avgPrice: number;
    totalPnl: number;
    orderTime: number;
    orderUpdateTime: number;
}

export interface BehavioralMetrics {
    tradesPerDay7d: number;
    tradesPerDay30d: number;
    winRate: number;
    consecutiveLosses: number;
    consecutiveWins: number;
    avgNotional: number;
    martingaleScore: number;
    totalRealizedPnl: number;
}

/**
 * Derive action from order side and positionSide
 * 
 * | side | positionSide | Action |
 * |------|--------------|--------|
 * | BUY  | LONG        | OPEN_LONG |
 * | SELL | LONG        | CLOSE_LONG |
 * | SELL | SHORT       | OPEN_SHORT |
 * | BUY  | SHORT       | CLOSE_SHORT |
 */
function getAction(side: string, positionSide: string): DerivedSignal['action'] {
    if (side === 'BUY' && positionSide === 'LONG') return 'OPEN_LONG';
    if (side === 'SELL' && positionSide === 'LONG') return 'CLOSE_LONG';
    if (side === 'SELL' && positionSide === 'SHORT') return 'OPEN_SHORT';
    if (side === 'BUY' && positionSide === 'SHORT') return 'CLOSE_SHORT';
    return 'OPEN_LONG'; // fallback
}

/**
 * Derive signals from order history when positions are hidden
 */
export function deriveSignalsFromOrders(leadId: string, orders: Order[]): DerivedSignal[] {
    if (!orders || orders.length === 0) return [];

    return orders.map(order => ({
        leadId,
        symbol: order.symbol,
        baseAsset: order.baseAsset || order.symbol.replace('USDT', ''),
        quoteAsset: order.quoteAsset || 'USDT',
        action: getAction(order.side, order.positionSide),
        notional: order.executedQty * order.avgPrice,
        executedQty: order.executedQty,
        avgPrice: order.avgPrice,
        realizedPnl: order.totalPnl || 0,
        timestamp: order.orderTime,
        source: 'DERIVED' as const,
    }));
}

/**
 * Check if trader has visible positions or needs fallback
 */
export function hasVisiblePositions(payload: any): boolean {
    const positions = payload?.activePositions;
    if (!positions || !Array.isArray(positions) || positions.length === 0) {
        return false;
    }
    // Check if positions have valid data
    return positions.some((p: any) => p.symbol && p.positionAmount);
}

/**
 * Calculate behavioral metrics from order history
 */
export function calculateBehavioralMetrics(orders: Order[]): BehavioralMetrics {
    if (!orders || orders.length === 0) {
        return {
            tradesPerDay7d: 0,
            tradesPerDay30d: 0,
            winRate: 0,
            consecutiveLosses: 0,
            consecutiveWins: 0,
            avgNotional: 0,
            martingaleScore: 0,
            totalRealizedPnl: 0,
        };
    }

    const now = Date.now();
    const day7 = now - 7 * 24 * 60 * 60 * 1000;
    const day30 = now - 30 * 24 * 60 * 60 * 1000;

    // Trades per day
    const trades7d = orders.filter(o => o.orderTime >= day7).length;
    const trades30d = orders.filter(o => o.orderTime >= day30).length;

    // Win rate (closing trades with positive PnL)
    const closingTrades = orders.filter(o =>
        (o.side === 'SELL' && o.positionSide === 'LONG') ||
        (o.side === 'BUY' && o.positionSide === 'SHORT')
    );
    const winningTrades = closingTrades.filter(o => o.totalPnl > 0).length;
    const winRate = closingTrades.length > 0 ? winningTrades / closingTrades.length : 0;

    // Consecutive losses/wins
    let consecutiveLosses = 0;
    let consecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let maxConsecutiveWins = 0;

    for (const order of closingTrades) {
        if (order.totalPnl < 0) {
            consecutiveLosses++;
            consecutiveWins = 0;
            maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
        } else if (order.totalPnl > 0) {
            consecutiveWins++;
            consecutiveLosses = 0;
            maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
        }
    }

    // Average notional
    const notionals = orders.map(o => o.executedQty * o.avgPrice);
    const avgNotional = notionals.reduce((a, b) => a + b, 0) / notionals.length;

    // Martingale detection
    const martingaleScore = detectMartingale(orders);

    // Total realized PnL
    const totalRealizedPnl = closingTrades.reduce((sum, o) => sum + o.totalPnl, 0);

    return {
        tradesPerDay7d: trades7d / 7,
        tradesPerDay30d: trades30d / 30,
        winRate,
        consecutiveLosses: maxConsecutiveLosses,
        consecutiveWins: maxConsecutiveWins,
        avgNotional,
        martingaleScore,
        totalRealizedPnl,
    };
}

/**
 * Detect martingale pattern (increasing position size after losses)
 */
function detectMartingale(orders: Order[]): number {
    // Group by symbol
    const bySymbol = new Map<string, Order[]>();
    for (const order of orders) {
        const existing = bySymbol.get(order.symbol) || [];
        existing.push(order);
        bySymbol.set(order.symbol, existing);
    }

    let score = 0;

    for (const [, symbolOrders] of bySymbol) {
        // Get opening orders sorted by time
        const openings = symbolOrders
            .filter(o =>
                (o.side === 'BUY' && o.positionSide === 'LONG') ||
                (o.side === 'SELL' && o.positionSide === 'SHORT')
            )
            .sort((a, b) => a.orderTime - b.orderTime);

        if (openings.length < 3) continue;

        // Check for increasing notional pattern (1.5x or more each time)
        let increasingStreak = 0;
        for (let i = 1; i < openings.length; i++) {
            const prevNotional = openings[i - 1].executedQty * openings[i - 1].avgPrice;
            const currNotional = openings[i].executedQty * openings[i].avgPrice;

            if (currNotional > prevNotional * 1.5) {
                increasingStreak++;
            } else {
                increasingStreak = 0;
            }

            if (increasingStreak >= 2) {
                score++;
                break;
            }
        }
    }

    return score;
}

/**
 * Calculate quality score for trader
 */
export function calculateQualityScore(
    portfolioDetail: any,
    roiSeries: any[],
    positions: any[],
    metrics: BehavioralMetrics
): number {
    let score = 50; // base score

    // ROI (25%)
    if (roiSeries && roiSeries.length >= 2) {
        const firstRoi = roiSeries[0]?.value || 0;
        const lastRoi = roiSeries[roiSeries.length - 1]?.value || 0;
        const roiChange = lastRoi - firstRoi;
        score += Math.min(Math.max(roiChange, -25), 25); // clamp -25 to +25
    }

    // Win rate (20%)
    score += metrics.winRate * 20;

    // Sharpe ratio (15%)
    const sharpe = parseFloat(portfolioDetail?.sharpRatio || '0');
    score += Math.min(sharpe, 3) * 5; // max 15 points

    // AUM (10%)
    const aum = parseFloat(portfolioDetail?.aumAmount || '0');
    if (aum > 0) {
        score += Math.min(Math.log10(aum), 6) * 1.67; // max 10 points
    }

    // Copier count (10%)
    const copiers = portfolioDetail?.currentCopyCount || 0;
    if (copiers > 0) {
        score += Math.min(Math.log10(copiers + 1), 4) * 2.5; // max 10 points
    }

    // Leverage penalty (-10%)
    if (positions && positions.length > 0) {
        const avgLeverage = positions.reduce((sum, p) => sum + (p.leverage || 0), 0) / positions.length;
        if (avgLeverage > 50) score -= 10;
        else if (avgLeverage > 30) score -= 5;
        else if (avgLeverage < 20) score += 5;
    }

    // Martingale penalty (-15%)
    if (metrics.martingaleScore > 0) {
        score -= Math.min(metrics.martingaleScore * 15, 15);
    }

    // Consecutive losses penalty (-5% each, max 3)
    score -= Math.min(metrics.consecutiveLosses, 3) * 5;

    // Clamp to 0-100
    return Math.min(Math.max(Math.round(score), 0), 100);
}
