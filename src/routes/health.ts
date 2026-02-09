import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/health',
        {
            schema: {
                description: 'Health check endpoint',
                tags: ['Health'],
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' },
                            timestamp: { type: 'string' },
                            uptime: { type: 'number' },
                        },
                    },
                },
            },
        },
        async (_request, reply) => {
            return reply.send({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            });
        }
    );
}
