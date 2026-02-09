import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

/**
 * API Key authentication middleware for protected routes
 */
export async function apiKeyAuth(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
        reply.code(401).send({
            success: false,
            error: 'Missing X-API-Key header',
        });
        return;
    }

    if (apiKey !== config.ingestApiKey) {
        reply.code(403).send({
            success: false,
            error: 'Invalid API key',
        });
        return;
    }
}

/**
 * Optional API key check (for endpoints that can be both public or protected)
 */
export async function optionalApiKeyAuth(
    request: FastifyRequest,
    _reply: FastifyReply
): Promise<void> {
    const apiKey = request.headers['x-api-key'];

    // Attach authentication status to request
    (request as FastifyRequest & { isAuthenticated: boolean }).isAuthenticated =
        apiKey === config.ingestApiKey;
}
