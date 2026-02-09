import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { apiKeyAuth } from '../middleware/auth.js';
import {
    ingestPayloadSchema,
    binanceRawPayloadSchema,
    isRawBinancePayload,
    transformBinancePayload,
    type IngestPayload
} from '../schemas/ingest.js';
import { upsertLeadTrader } from '../services/leadTrader.js';
import { insertPositionSnapshots } from '../services/position.js';
import { insertEvents } from '../services/event.js';
import { recomputeAggregations } from '../services/aggregation.js';
import { updateTraderScore } from '../services/traderScore.js';
import { updateTraderWeight } from '../services/traderWeight.js';
import { trackPositionStates } from '../services/positionState.js';
import { trackHiddenPositionStates } from '../services/hiddenPositionState.js';

export async function ingestRoutes(fastify: FastifyInstance) {
    // Add API key authentication hook for all ingest routes
    fastify.addHook('preHandler', apiKeyAuth);

    fastify.post(
        '/ingest/binance-copytrade',
        {
            schema: {
                description: 'Ingest positions and events from Binance Copy Trading scraper. Accepts both raw Binance format (with activePositions/orderHistory) and normalized format (with positions/events).',
                tags: ['Ingest'],
                security: [{ apiKey: [] }],
                body: {
                    type: 'object',
                    required: ['leadId', 'fetchedAt'],
                    properties: {
                        leadId: { type: 'string' },
                        fetchedAt: { type: 'string', format: 'date-time' },
                        // Raw Binance format fields
                        activePositions: { type: 'array' },
                        orderHistory: { type: 'object' },
                        // Normalized format fields
                        positions: { type: 'array' },
                        events: { type: 'array' },
                        // Optional metadata (raw format)
                        timeRange: { type: 'string' },
                        startTime: { type: 'number' },
                        endTime: { type: 'number' },
                        leadCommon: { type: 'object', nullable: true },
                        portfolioDetail: { type: 'object', nullable: true },
                        roiSeries: { type: 'array' },
                        assetPreferences: { type: 'object', nullable: true },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                properties: {
                                    leadId: { type: 'string' },
                                    positionsInserted: { type: 'integer' },
                                    eventsInserted: { type: 'integer' },
                                    eventsSkipped: { type: 'integer' },
                                    symbolsAggregated: { type: 'integer' },
                                    traderScore: { type: 'number' },
                                    format: { type: 'string', enum: ['raw_binance', 'normalized'] },
                                    positionStates: {
                                        type: 'object',
                                        properties: {
                                            newPositions: { type: 'integer' },
                                            updatedPositions: { type: 'integer' },
                                            closedPositions: { type: 'integer' },
                                        },
                                    },
                                    hiddenPositionStates: {
                                        type: 'object',
                                        properties: {
                                            newPositions: { type: 'integer' },
                                            closedPositions: { type: 'integer' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            error: { type: 'string' },
                            details: { type: 'array', items: { type: 'object' } },
                        },
                    },
                },
            },
        },
        async (
            request: FastifyRequest<{ Body: unknown }>,
            reply: FastifyReply
        ) => {
            let payload: IngestPayload;
            let format: 'raw_binance' | 'normalized' = 'normalized';

            // Auto-detect payload format
            if (isRawBinancePayload(request.body)) {
                // Parse as raw Binance format
                format = 'raw_binance';
                const rawParseResult = binanceRawPayloadSchema.safeParse(request.body);

                if (!rawParseResult.success) {
                    return reply.code(400).send({
                        success: false,
                        error: 'Validation failed (raw Binance format)',
                        details: rawParseResult.error.errors,
                    });
                }

                // Transform to normalized format
                payload = transformBinancePayload(rawParseResult.data);

                fastify.log.info({
                    leadId: payload.leadId,
                    activePositions: rawParseResult.data.activePositions?.length || 0,
                    orders: rawParseResult.data.orderHistory?.allOrders?.length || 0,
                }, 'Transformed raw Binance payload');
            } else {
                // Parse as normalized format
                const parseResult = ingestPayloadSchema.safeParse(request.body);

                if (!parseResult.success) {
                    return reply.code(400).send({
                        success: false,
                        error: 'Validation failed (normalized format)',
                        details: parseResult.error.errors,
                    });
                }

                payload = parseResult.data;
            }

            const fetchedAt = new Date(payload.fetchedAt);

            try {
                // 1. Upsert lead trader (FAZ 0: extract positionShow + nickname from raw body)
                const rawBody = request.body as Record<string, any>;
                const portfolioDetail = rawBody?.portfolioDetail;
                const positionShow = typeof portfolioDetail?.positionShow === 'boolean'
                    ? portfolioDetail.positionShow as boolean
                    : undefined;
                const nickname = typeof portfolioDetail?.nickname === 'string'
                    ? portfolioDetail.nickname as string
                    : undefined;

                await upsertLeadTrader(payload.leadId, 'binance', { positionShow, nickname });

                // 2. Insert position snapshots
                const positionsInserted = await insertPositionSnapshots(
                    payload.positions,
                    fetchedAt
                );

                // 2b. YOL 2: Track position states (VISIBLE traders - from activePositions)
                const positionStateUpdate = await trackPositionStates(
                    payload.positions,
                    fetchedAt,
                    'binance'
                );

                // 3. Insert events (with deduplication)
                const { inserted: eventsInserted, skipped: eventsSkipped } =
                    await insertEvents(payload.events, fetchedAt);

                // 3b. FAZ 1+2: Track HIDDEN trader positions (from orderHistory events)
                const hiddenPositionStateUpdate = await trackHiddenPositionStates(
                    payload.leadId,
                    payload.events,
                    fetchedAt,
                    'binance'
                );

                // 4. Recompute symbol aggregations
                const symbolsAggregated = await recomputeAggregations('binance');

                // 5. Update trader score
                const traderScore = await updateTraderScore(payload.leadId, 'binance');

                // 6. FAZ 0: Update consensus weight
                await updateTraderWeight(payload.leadId, 'binance');

                fastify.log.info({
                    leadId: payload.leadId,
                    format,
                    positionsInserted,
                    eventsInserted,
                    eventsSkipped,
                    positionStates: positionStateUpdate,
                    hiddenPositionStates: hiddenPositionStateUpdate,
                }, 'Ingest completed');

                return reply.send({
                    success: true,
                    data: {
                        leadId: payload.leadId,
                        positionsInserted,
                        eventsInserted,
                        eventsSkipped,
                        symbolsAggregated,
                        traderScore,
                        format,
                        positionStates: positionStateUpdate,
                        hiddenPositionStates: hiddenPositionStateUpdate,
                    },
                });
            } catch (error) {
                fastify.log.error(error, 'Error processing ingest');
                return reply.code(500).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error',
                });
            }
        }
    );
}
