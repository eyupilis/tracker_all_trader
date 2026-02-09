import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { ingestRoutes } from './routes/ingest.js';
import { rawIngestRoutes } from './routes/rawIngest.js';
import { symbolsRoutes } from './routes/symbols.js';
import { tradersRoutes } from './routes/traders.js';
import { signalsRoutes } from './routes/signals.js';
import { simulationRoutes } from './routes/simulation.js';

export async function buildApp(): Promise<FastifyInstance> {
    const fastify = Fastify({
        logger: {
            level: config.isDevelopment ? 'debug' : 'info',
            transport: config.isDevelopment
                ? {
                    target: 'pino-pretty',
                    options: {
                        translateTime: 'HH:MM:ss Z',
                        ignore: 'pid,hostname',
                    },
                }
                : undefined,
        },
    });

    // Register CORS
    await fastify.register(cors, {
        origin: true, // Allow all origins for MVP
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    });

    // Register rate limiting
    await fastify.register(rateLimit, {
        max: config.rateLimitMax,
        timeWindow: config.rateLimitWindowMs,
        allowList: (req) => {
            // Skip rate limiting for non-ingest endpoints
            return !req.url.startsWith('/ingest');
        },
    });

    // Register Swagger documentation
    await fastify.register(swagger, {
        openapi: {
            info: {
                title: 'Copy-Trading Position Aggregator API',
                description: 'Backend API for aggregating Binance Copy Trading positions and events',
                version: '1.0.0',
            },
            servers: [
                { url: `http://localhost:${config.port}`, description: 'Development server' },
            ],
            tags: [
                { name: 'Health', description: 'Health check endpoints' },
                { name: 'Ingest', description: 'Data ingestion endpoints (protected)' },
                { name: 'Symbols', description: 'Symbol aggregation and feed endpoints' },
                { name: 'Traders', description: 'Trader information endpoints' },
            ],
            components: {
                securitySchemes: {
                    apiKey: {
                        type: 'apiKey',
                        name: 'X-API-Key',
                        in: 'header',
                    },
                },
            },
        },
    });

    await fastify.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
        },
    });

    // Register routes
    await fastify.register(healthRoutes);
    await fastify.register(ingestRoutes);
    await fastify.register(rawIngestRoutes); // NEW: Raw data storage
    await fastify.register(symbolsRoutes);
    await fastify.register(tradersRoutes);
    await fastify.register(signalsRoutes); // FAZ 2: Signal aggregation
    await fastify.register(simulationRoutes); // Sprint 1: Risk management & portfolios

    // Global error handler
    fastify.setErrorHandler((error, _request, reply) => {
        fastify.log.error(error);

        // Handle validation errors
        if (error.validation) {
            return reply.code(400).send({
                success: false,
                error: 'Validation error',
                details: error.validation,
            });
        }

        // Handle rate limit errors
        if (error.statusCode === 429) {
            return reply.code(429).send({
                success: false,
                error: 'Too many requests',
            });
        }

        // Generic error response
        return reply.code(error.statusCode || 500).send({
            success: false,
            error: config.isDevelopment ? error.message : 'Internal server error',
        });
    });

    return fastify;
}
