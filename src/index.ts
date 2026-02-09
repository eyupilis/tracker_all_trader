import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db/prisma.js';
import { BinanceScheduler } from './services/scheduler.js';

let scheduler: BinanceScheduler | null = null;

async function main() {
    const app = await buildApp();

    // Test database connection
    try {
        await prisma.$connect();
        app.log.info('✅ Database connected');
    } catch (error) {
        app.log.error({ err: error }, '❌ Database connection failed');
        process.exit(1);
    }

    // Start server
    try {
        await app.listen({ port: config.port, host: '0.0.0.0' });
        app.log.info(`
🚀 Copy-Trading Aggregator API running
   ├─ API: http://localhost:${config.port}
   ├─ Docs: http://localhost:${config.port}/docs
   └─ Health: http://localhost:${config.port}/health
    `);
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }

    // Start the Binance scraper scheduler
    scheduler = new BinanceScheduler({
        enabled: config.scraper.enabled,
        intervalMs: config.scraper.intervalMs,
        leadIds: config.scraper.leadIds,
        concurrency: config.scraper.concurrency,
        orderPageSize: config.scraper.orderPageSize,
        timeoutMs: config.scraper.timeoutMs,
    });
    scheduler.start();

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
        process.on(signal, async () => {
            app.log.info(`Received ${signal}, shutting down gracefully...`);
            scheduler?.stop();
            await app.close();
            await prisma.$disconnect();
            process.exit(0);
        });
    });
}

main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
