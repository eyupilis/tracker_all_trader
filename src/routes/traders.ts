import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    tradersTopQuerySchema,
    traderPositionsQuerySchema,
    type TradersTopQuery,
    type TraderPositionsQuery,
} from '../schemas/ingest.js';
import { getTopTraders } from '../services/traderScore.js';
import { getLatestPositionsForTrader } from '../services/position.js';
import { getLeadTrader } from '../services/leadTrader.js';

export async function tradersRoutes(fastify: FastifyInstance) {
    // GET /traders/top - Get top traders by score
    fastify.get(
        '/traders/top',
        {
            schema: {
                description: 'Get top traders ordered by 30-day score',
                tags: ['Traders'],
                querystring: {
                    type: 'object',
                    properties: {
                        platform: { type: 'string', default: 'binance' },
                        range: { type: 'string', enum: ['7d', '30d', '90d'], default: '30d' },
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
                                        leadId: { type: 'string' },
                                        score30d: { type: 'number' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (
            request: FastifyRequest<{ Querystring: TradersTopQuery }>,
            reply: FastifyReply
        ) => {
            const parseResult = tradersTopQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid query parameters',
                    details: parseResult.error.errors,
                });
            }

            const { platform, limit } = parseResult.data;
            // Note: range parameter is defined for future use; currently MVP uses 30d only

            try {
                const traders = await getTopTraders(platform, limit);

                return reply.send({
                    success: true,
                    data: traders,
                });
            } catch (error) {
                fastify.log.error(error, 'Error fetching top traders');
                return reply.code(500).send({
                    success: false,
                    error: 'Internal server error',
                });
            }
        }
    );

    // GET /traders/:leadId - Get trader info
    fastify.get(
        '/traders/:leadId',
        {
            schema: {
                description: 'Get trader information by leadId',
                tags: ['Traders'],
                params: {
                    type: 'object',
                    required: ['leadId'],
                    properties: {
                        leadId: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    properties: {
                        platform: { type: 'string', default: 'binance' },
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
                                    platform: { type: 'string' },
                                    score30d: { type: 'number', nullable: true },
                                    createdAt: { type: 'string' },
                                    updatedAt: { type: 'string' },
                                },
                            },
                        },
                    },
                    404: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            error: { type: 'string' },
                        },
                    },
                },
            },
        },
        async (
            request: FastifyRequest<{
                Params: { leadId: string };
                Querystring: TraderPositionsQuery;
            }>,
            reply: FastifyReply
        ) => {
            const { leadId } = request.params;

            try {
                const trader = await getLeadTrader(leadId);

                if (!trader) {
                    return reply.code(404).send({
                        success: false,
                        error: 'Trader not found',
                    });
                }

                return reply.send({
                    success: true,
                    data: {
                        leadId: trader.id,
                        platform: trader.platform,
                        score30d: trader.traderScore?.score30d ?? null,
                        createdAt: trader.createdAt.toISOString(),
                        updatedAt: trader.updatedAt.toISOString(),
                    },
                });
            } catch (error) {
                fastify.log.error(error, 'Error fetching trader');
                return reply.code(500).send({
                    success: false,
                    error: 'Internal server error',
                });
            }
        }
    );

    // GET /traders/:leadId/positions - Get latest positions for a trader
    fastify.get(
        '/traders/:leadId/positions',
        {
            schema: {
                description: 'Get latest position snapshot for a trader',
                tags: ['Traders'],
                params: {
                    type: 'object',
                    required: ['leadId'],
                    properties: {
                        leadId: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    properties: {
                        platform: { type: 'string', default: 'binance' },
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
                                        id: { type: 'string' },
                                        symbol: { type: 'string' },
                                        side: { type: 'string' },
                                        leverage: { type: 'integer', nullable: true },
                                        size: { type: 'number' },
                                        sizeAsset: { type: 'string', nullable: true },
                                        entryPrice: { type: 'number' },
                                        markPrice: { type: 'number', nullable: true },
                                        marginUSDT: { type: 'number', nullable: true },
                                        pnlUSDT: { type: 'number', nullable: true },
                                        roePct: { type: 'number', nullable: true },
                                        fetchedAt: { type: 'string' },
                                    },
                                },
                            },
                            meta: {
                                type: 'object',
                                properties: {
                                    leadId: { type: 'string' },
                                    positionCount: { type: 'integer' },
                                    fetchedAt: { type: 'string', nullable: true },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (
            request: FastifyRequest<{
                Params: { leadId: string };
                Querystring: TraderPositionsQuery;
            }>,
            reply: FastifyReply
        ) => {
            const { leadId } = request.params;
            const parseResult = traderPositionsQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid query parameters',
                    details: parseResult.error.errors,
                });
            }

            const { platform } = parseResult.data;

            try {
                const positions = await getLatestPositionsForTrader(leadId, platform);

                return reply.send({
                    success: true,
                    data: positions.map((p) => ({
                        id: p.id,
                        symbol: p.symbol,
                        side: p.side,
                        leverage: p.leverage,
                        size: p.size,
                        sizeAsset: p.sizeAsset,
                        entryPrice: p.entryPrice,
                        markPrice: p.markPrice,
                        marginUSDT: p.marginUSDT,
                        pnlUSDT: p.pnlUSDT,
                        roePct: p.roePct,
                        fetchedAt: p.fetchedAt.toISOString(),
                    })),
                    meta: {
                        leadId,
                        positionCount: positions.length,
                        fetchedAt: positions[0]?.fetchedAt.toISOString() ?? null,
                    },
                });
            } catch (error) {
                fastify.log.error(error, 'Error fetching trader positions');
                return reply.code(500).send({
                    success: false,
                    error: 'Internal server error',
                });
            }
        }
    );
}
