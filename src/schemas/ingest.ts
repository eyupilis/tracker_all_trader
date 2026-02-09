import { z } from 'zod';

// ============================================
// BINANCE RAW FORMAT SCHEMAS (from n8n scraper)
// ============================================

// Raw Binance position from activePositions array
const binanceRawPositionSchema = z.object({
    id: z.string().optional(),
    symbol: z.string(),
    collateral: z.string().optional(),
    positionAmount: z.union([z.string(), z.number()]),
    entryPrice: z.union([z.string(), z.number()]),
    markPrice: z.union([z.string(), z.number()]),
    leverage: z.number(),
    isolated: z.boolean().optional(),
    // Binance can return BOTH for one-way mode traders
    positionSide: z.enum(['LONG', 'SHORT', 'BOTH']),
    unrealizedProfit: z.union([z.string(), z.number()]).optional(),
    cumRealized: z.union([z.string(), z.number()]).optional(),
    notionalValue: z.union([z.string(), z.number()]).optional(),
    breakEvenPrice: z.union([z.string(), z.number()]).optional(),
    adl: z.number().optional(),
});

// Raw Binance order from orderHistory.allOrders array
const binanceRawOrderSchema = z.object({
    symbol: z.string(),
    baseAsset: z.string().optional(),
    quoteAsset: z.string().optional(),
    side: z.enum(['BUY', 'SELL']),
    type: z.string().optional(),
    // Binance can return BOTH for one-way mode traders
    positionSide: z.enum(['LONG', 'SHORT', 'BOTH']),
    executedQty: z.number(),
    avgPrice: z.number(),
    totalPnl: z.number().optional(),
    orderUpdateTime: z.number(),
    orderTime: z.number().optional(),
});

// Raw payload from n8n scraper (Build Final Payload output)
export const binanceRawPayloadSchema = z.object({
    leadId: z.string(),
    fetchedAt: z.string().datetime(),
    timeRange: z.string().optional(),
    startTime: z.number().optional(),
    endTime: z.number().optional(),
    leadCommon: z.record(z.unknown()).nullable().optional(),
    portfolioDetail: z.record(z.unknown()).nullable().optional(),
    roiSeries: z.array(z.record(z.unknown())).optional(),
    assetPreferences: z.record(z.unknown()).nullable().optional(),
    activePositions: z.array(binanceRawPositionSchema).default([]),
    orderHistory: z.object({
        total: z.number().optional(),
        allOrders: z.array(binanceRawOrderSchema).default([]),
    }).optional(),
});

export type BinanceRawPayload = z.infer<typeof binanceRawPayloadSchema>;

// ============================================
// NORMALIZED FORMAT SCHEMAS (internal format)
// ============================================

// Position schema for a single position in the payload
export const positionSchema = z.object({
    platform: z.string().default('binance'),
    leadId: z.string(),
    symbol: z.string(),
    contractType: z.string().optional().nullable(),
    leverage: z.number().int().optional().nullable(),
    size: z.number(),
    sizeAsset: z.string().optional().nullable(),
    side: z.enum(['LONG', 'SHORT']),
    entryPrice: z.number(),
    markPrice: z.number().optional().nullable(),
    marginUSDT: z.number().optional().nullable(),
    marginType: z.string().optional().nullable(),
    pnlUSDT: z.number().optional().nullable(),
    roePct: z.number().optional().nullable(),
    fetchedAt: z.string().datetime(),
});

export type PositionInput = z.infer<typeof positionSchema>;

// Event types enum
export const eventTypeEnum = z.enum([
    'OPEN_LONG',
    'OPEN_SHORT',
    'CLOSE_LONG',
    'CLOSE_SHORT',
    'UNKNOWN',
]);

export type EventType = z.infer<typeof eventTypeEnum>;

// Event schema for a single event in the payload
export const eventSchema = z.object({
    platform: z.string().default('binance'),
    leadId: z.string(),
    eventTimeText: z.string(),
    eventType: eventTypeEnum,
    symbol: z.string(),
    price: z.number().optional().nullable(),
    amount: z.number().optional().nullable(),
    amountAsset: z.string().optional().nullable(),
    realizedPnl: z.number().optional().nullable(),
    fetchedAt: z.string().datetime(),
    event_key: z.string(), // Unique key for deduplication
});

export type EventInput = z.infer<typeof eventSchema>;

// Main ingest payload schema (normalized format)
export const ingestPayloadSchema = z.object({
    leadId: z.string(),
    fetchedAt: z.string().datetime(),
    positions: z.array(positionSchema).default([]),
    events: z.array(eventSchema).default([]),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

// ============================================
// TRANSFORM FUNCTIONS
// ============================================

/**
 * Detect if payload is raw Binance format or normalized format
 */
export function isRawBinancePayload(payload: unknown): boolean {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    // Raw format has activePositions or orderHistory
    return 'activePositions' in p || 'orderHistory' in p;
}

/**
 * Transform raw Binance format to normalized format
 */
export function transformBinancePayload(raw: BinanceRawPayload): IngestPayload {
    const { leadId, fetchedAt, activePositions, orderHistory } = raw;

    // Transform activePositions → positions
    const positions: PositionInput[] = (activePositions || []).map((pos) => {
        const positionAmount = parseFloat(String(pos.positionAmount));
        // In one-way mode (BOTH), infer side from signed position amount
        const normalizedSide = pos.positionSide === 'BOTH'
            ? (positionAmount >= 0 ? 'LONG' : 'SHORT')
            : pos.positionSide;

        return {
            platform: 'binance',
            leadId,
            symbol: pos.symbol,
            contractType: 'PERP',
            leverage: pos.leverage,
            size: positionAmount,
            sizeAsset: pos.symbol.replace('USDT', ''),
            side: normalizedSide,
            entryPrice: parseFloat(String(pos.entryPrice)),
            markPrice: parseFloat(String(pos.markPrice)),
            marginUSDT: pos.notionalValue
                ? Math.abs(parseFloat(String(pos.notionalValue)) / pos.leverage)
                : null,
            marginType: pos.isolated ? 'ISOLATED' : 'CROSS',
            pnlUSDT: pos.unrealizedProfit
                ? parseFloat(String(pos.unrealizedProfit))
                : null,
            roePct: null,
            fetchedAt,
        };
    });

    // Transform orderHistory.allOrders → events
    const events: EventInput[] = (orderHistory?.allOrders || []).map((order) => {
        // Determine event type based on side + positionSide
        let eventType: EventType = 'UNKNOWN';
        if (order.side === 'BUY' && order.positionSide === 'LONG') {
            eventType = 'OPEN_LONG';
        } else if (order.side === 'SELL' && order.positionSide === 'LONG') {
            eventType = 'CLOSE_LONG';
        } else if (order.side === 'BUY' && order.positionSide === 'SHORT') {
            eventType = 'CLOSE_SHORT';
        } else if (order.side === 'SELL' && order.positionSide === 'SHORT') {
            eventType = 'OPEN_SHORT';
        }

        // Format timestamp to "MM-DD, HH:MM:SS"
        const orderDate = new Date(order.orderUpdateTime);
        const month = String(orderDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(orderDate.getUTCDate()).padStart(2, '0');
        const hours = String(orderDate.getUTCHours()).padStart(2, '0');
        const minutes = String(orderDate.getUTCMinutes()).padStart(2, '0');
        const seconds = String(orderDate.getUTCSeconds()).padStart(2, '0');
        const eventTimeText = `${month}-${day}, ${hours}:${minutes}:${seconds}`;

        // Generate unique event_key
        const event_key = `binance|${leadId}|${eventType}|${order.symbol}|${eventTimeText}|${order.executedQty}|${order.avgPrice}`;

        return {
            platform: 'binance',
            leadId,
            eventTimeText,
            eventType,
            symbol: order.symbol,
            price: order.avgPrice,
            amount: order.executedQty,
            amountAsset: order.baseAsset || order.symbol.replace('USDT', ''),
            realizedPnl: order.totalPnl && order.totalPnl > 0 ? order.totalPnl : null,
            fetchedAt,
            event_key,
        };
    });

    return {
        leadId,
        fetchedAt,
        positions,
        events,
    };
}

// ============================================
// QUERY PARAMETER SCHEMAS
// ============================================

export const symbolsQuerySchema = z.object({
    platform: z.string().default('binance'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

export type SymbolsQuery = z.infer<typeof symbolsQuerySchema>;

export const symbolFeedQuerySchema = z.object({
    platform: z.string().default('binance'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type SymbolFeedQuery = z.infer<typeof symbolFeedQuerySchema>;

export const tradersTopQuerySchema = z.object({
    platform: z.string().default('binance'),
    range: z.enum(['7d', '30d', '90d']).default('30d'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type TradersTopQuery = z.infer<typeof tradersTopQuerySchema>;

export const traderPositionsQuerySchema = z.object({
    platform: z.string().default('binance'),
});

export type TraderPositionsQuery = z.infer<typeof traderPositionsQuerySchema>;
