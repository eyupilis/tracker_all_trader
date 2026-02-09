import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { apiKeyAuth } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

// Minimal validation - just require leadId and fetchedAt
interface RawIngestBody {
    leadId: string;
    fetchedAt: string;
    activePositions?: unknown[];
    orderHistory?: {
        total?: number;
        allOrders?: unknown[];
    };
    positionAudit?: {
        sourceRawPositionsCount?: number;
        filteredActivePositionsCount?: number;
        droppedPositionsCount?: number;
        nonZeroByAmountCount?: number;
        nonZeroByNotionalCount?: number;
        nonZeroByUnrealizedCount?: number;
        droppedBecauseAllZeroCount?: number;
        [key: string]: unknown;
    };
    timeRange?: string;
    [key: string]: unknown; // Accept any additional fields
}

function toSafeNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export async function rawIngestRoutes(fastify: FastifyInstance) {
    // Add API key authentication hook
    fastify.addHook('preHandler', apiKeyAuth);

    /**
     * POST /ingest/raw
     * 
     * Stores the COMPLETE n8n payload as-is without any transformation.
     * Use this endpoint to ensure no data is lost.
     */
    fastify.post(
        '/ingest/raw',
        {
            schema: {
                description: 'Store raw n8n payload without any transformation. Ensures complete data capture.',
                tags: ['Ingest'],
                security: [{ apiKey: [] }],
                body: {
                    type: 'object',
                    required: ['leadId', 'fetchedAt'],
                    properties: {
                        leadId: { type: 'string' },
                        fetchedAt: { type: 'string', format: 'date-time' },
                    },
                    additionalProperties: true, // Accept ANY additional properties
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    leadId: { type: 'string' },
                                    fetchedAt: { type: 'string' },
                                    positionsCount: { type: 'integer' },
                                    ordersCount: { type: 'integer' },
                                    payloadSize: { type: 'integer' },
                                    parity: {
                                        type: 'object',
                                        nullable: true,
                                        properties: {
                                            sourceRawPositionsCount: { type: 'integer', nullable: true },
                                            filteredActivePositionsCount: { type: 'integer', nullable: true },
                                            backendStoredPositionsCount: { type: 'integer' },
                                            filteredMatchesStored: { type: 'boolean', nullable: true },
                                        },
                                    },
                                    message: { type: 'string' },
                                },
                            },
                        },
                    },
                    400: {
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
            request: FastifyRequest<{ Body: RawIngestBody }>,
            reply: FastifyReply
        ) => {
            const body = request.body;

            // Basic validation
            if (!body.leadId || typeof body.leadId !== 'string') {
                return reply.code(400).send({
                    success: false,
                    error: 'leadId is required and must be a string',
                });
            }

            if (!body.fetchedAt || typeof body.fetchedAt !== 'string') {
                return reply.code(400).send({
                    success: false,
                    error: 'fetchedAt is required and must be an ISO date string',
                });
            }

            // Parse fetchedAt
            const fetchedAt = new Date(body.fetchedAt);
            if (isNaN(fetchedAt.getTime())) {
                return reply.code(400).send({
                    success: false,
                    error: 'fetchedAt must be a valid ISO date string',
                });
            }

            // Extract counts from payload
            const positionsCount = Array.isArray(body.activePositions)
                ? body.activePositions.length
                : 0;

            const ordersCount = Array.isArray(body.orderHistory?.allOrders)
                ? body.orderHistory.allOrders.length
                : 0;
            const sourceRawPositionsCount = toSafeNumber(body.positionAudit?.sourceRawPositionsCount);
            const filteredActivePositionsCount = toSafeNumber(body.positionAudit?.filteredActivePositionsCount);
            const filteredMatchesStored =
                filteredActivePositionsCount === null
                    ? null
                    : filteredActivePositionsCount === positionsCount;

            try {
                // Store the COMPLETE payload as-is
                const rawIngest = await prisma.rawIngest.create({
                    data: {
                        leadId: body.leadId,
                        platform: 'binance',
                        fetchedAt,
                        payload: body as object, // Store entire body
                        positionsCount,
                        ordersCount,
                        timeRange: body.timeRange || null,
                    },
                });

                // Calculate payload size for logging
                const payloadSize = JSON.stringify(body).length;

                fastify.log.info({
                    id: rawIngest.id,
                    leadId: body.leadId,
                    positionsCount,
                    ordersCount,
                    payloadSize,
                }, '✅ Raw payload stored successfully');

                if (filteredMatchesStored === false) {
                    fastify.log.warn({
                        leadId: body.leadId,
                        sourceRawPositionsCount,
                        filteredActivePositionsCount,
                        backendStoredPositionsCount: positionsCount,
                    }, '⚠️ Position parity mismatch between n8n audit and stored raw payload');
                } else if (filteredMatchesStored === true) {
                    fastify.log.info({
                        leadId: body.leadId,
                        sourceRawPositionsCount,
                        filteredActivePositionsCount,
                        backendStoredPositionsCount: positionsCount,
                    }, '✅ Position parity check passed (n8n audit vs stored raw payload)');
                }

                return reply.send({
                    success: true,
                    data: {
                        id: rawIngest.id,
                        leadId: rawIngest.leadId,
                        fetchedAt: rawIngest.fetchedAt.toISOString(),
                        positionsCount,
                        ordersCount,
                        payloadSize,
                        parity: {
                            sourceRawPositionsCount,
                            filteredActivePositionsCount,
                            backendStoredPositionsCount: positionsCount,
                            filteredMatchesStored,
                        },
                        message: 'Raw payload stored successfully. No data lost.',
                    },
                });
            } catch (error) {
                fastify.log.error(error, 'Error storing raw payload');
                return reply.code(500).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Internal server error',
                });
            }
        }
    );

    /**
     * GET /ingest/raw/:leadId
     * 
     * Retrieve stored raw payloads for a lead trader
     */
    fastify.get(
        '/ingest/raw/:leadId',
        {
            schema: {
                description: 'Retrieve stored raw payloads for a lead trader',
                tags: ['Ingest'],
                security: [{ apiKey: [] }],
                params: {
                    type: 'object',
                    properties: {
                        leadId: { type: 'string' },
                    },
                },
                querystring: {
                    type: 'object',
                    properties: {
                        limit: { type: 'integer', default: 10 },
                        includePayload: { type: 'boolean', default: false },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: { type: 'array' },
                            meta: {
                                type: 'object',
                                properties: {
                                    total: { type: 'integer' },
                                    leadId: { type: 'string' },
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
                Querystring: { limit?: number; includePayload?: boolean };
            }>,
            reply: FastifyReply
        ) => {
            const { leadId } = request.params;
            const limit = request.query.limit || 10;
            const includePayload = request.query.includePayload || false;

            const rawIngests = await prisma.rawIngest.findMany({
                where: { leadId },
                orderBy: { fetchedAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    leadId: true,
                    fetchedAt: true,
                    positionsCount: true,
                    ordersCount: true,
                    timeRange: true,
                    createdAt: true,
                    payload: includePayload,
                },
            });

            const total = await prisma.rawIngest.count({ where: { leadId } });

            return reply.send({
                success: true,
                data: rawIngests,
                meta: {
                    total,
                    leadId,
                },
            });
        }
    );

    /**
     * GET /ingest/raw/latest
     * 
     * Get the most recent raw ingests across all traders
     */
    fastify.get(
        '/ingest/raw/latest',
        {
            schema: {
                description: 'Get the most recent raw ingests',
                tags: ['Ingest'],
                security: [{ apiKey: [] }],
                querystring: {
                    type: 'object',
                    properties: {
                        limit: { type: 'integer', default: 20 },
                    },
                },
            },
        },
        async (
            request: FastifyRequest<{ Querystring: { limit?: number } }>,
            reply: FastifyReply
        ) => {
            const limit = request.query.limit || 20;

            const rawIngests = await prisma.rawIngest.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    id: true,
                    leadId: true,
                    fetchedAt: true,
                    positionsCount: true,
                    ordersCount: true,
                    timeRange: true,
                    createdAt: true,
                },
            });

            return reply.send({
                success: true,
                data: rawIngests,
            });
        }
    );
}
