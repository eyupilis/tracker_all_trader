import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    symbolsQuerySchema,
    symbolFeedQuerySchema,
    type SymbolsQuery,
    type SymbolFeedQuery,
} from '../schemas/ingest.js';
import {
    getSymbolAggregations,
    getSymbolAggregationsCount,
} from '../services/aggregation.js';
import { getEventsBySymbol } from '../services/event.js';

export async function symbolsRoutes(fastify: FastifyInstance) {
    // GET /symbols - List symbols ordered by popularity
    fastify.get(
        '/symbols',
        {
            schema: {
                description: 'Get symbols ordered by total open positions',
                tags: ['Symbols'],
                querystring: {
                    type: 'object',
                    properties: {
                        platform: { type: 'string', default: 'binance' },
                        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                        offset: { type: 'integer', minimum: 0, default: 0 },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        symbol: { type: 'string' },
                                        openLongCount: { type: 'integer' },
                                        openShortCount: { type: 'integer' },
                                        totalOpen: { type: 'integer' },
                                        latestEventAt: { type: 'string', nullable: true },
                                    },
                                },
                            },
                            meta: {
                                type: 'object',
                                properties: {
                                    total: { type: 'integer' },
                                    limit: { type: 'integer' },
                                    offset: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (
            request: FastifyRequest<{ Querystring: SymbolsQuery }>,
            reply: FastifyReply
        ) => {
            const parseResult = symbolsQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid query parameters',
                    details: parseResult.error.errors,
                });
            }

            const { platform, limit, offset } = parseResult.data;

            try {
                const [symbols, total] = await Promise.all([
                    getSymbolAggregations(platform, limit, offset),
                    getSymbolAggregationsCount(platform),
                ]);

                return reply.send({
                    success: true,
                    data: symbols.map((s) => ({
                        ...s,
                        latestEventAt: s.latestEventAt?.toISOString() ?? null,
                    })),
                    meta: {
                        total,
                        limit,
                        offset,
                    },
                });
            } catch (error) {
                fastify.log.error(error, 'Error fetching symbols');
                return reply.code(500).send({
                    success: false,
                    error: 'Internal server error',
                });
            }
        }
    );

    // GET /symbols/:symbol/feed - Get latest events for a symbol
    fastify.get(
        '/symbols/:symbol/feed',
        {
            schema: {
                description: 'Get latest events (feed) for a specific symbol',
                tags: ['Symbols'],
                params: {
                    type: 'object',
                    required: ['symbol'],
                    properties: {
                        symbol: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    properties: {
                        platform: { type: 'string', default: 'binance' },
                        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        eventType: { type: 'string' },
                                        eventTimeText: { type: 'string' },
                                        eventTime: { type: 'string', nullable: true },
                                        leadId: { type: 'string' },
                                        price: { type: 'number', nullable: true },
                                        amount: { type: 'number', nullable: true },
                                        realizedPnl: { type: 'number', nullable: true },
                                        eventKey: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (
            request: FastifyRequest<{
                Params: { symbol: string };
                Querystring: SymbolFeedQuery;
            }>,
            reply: FastifyReply
        ) => {
            const { symbol } = request.params;
            const parseResult = symbolFeedQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid query parameters',
                    details: parseResult.error.errors,
                });
            }

            const { platform, limit } = parseResult.data;

            try {
                const events = await getEventsBySymbol(symbol, platform, limit);

                return reply.send({
                    success: true,
                    data: events.map((e) => ({
                        ...e,
                        eventTime: e.eventTime?.toISOString() ?? null,
                    })),
                });
            } catch (error) {
                fastify.log.error(error, 'Error fetching symbol feed');
                return reply.code(500).send({
                    success: false,
                    error: 'Internal server error',
                });
            }
        }
    );
}
