import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Starting seed...');

    // Create a sample lead trader
    const leadId = '4681698170884314113';

    const trader = await prisma.leadTrader.upsert({
        where: { id: leadId },
        update: {},
        create: {
            id: leadId,
            platform: 'binance',
        },
    });
    console.log(`✅ Created lead trader: ${trader.id}`);

    // Create sample positions
    const now = new Date();
    const positions = [
        {
            platform: 'binance',
            leadId,
            fetchedAt: now,
            symbol: 'BTCUSDT',
            side: 'SHORT',
            contractType: 'PERP',
            leverage: 120,
            size: -0.108,
            sizeAsset: 'BTC',
            entryPrice: 86232.48,
            markPrice: 72469.70,
            marginUSDT: 65.22,
            marginType: 'CROSS',
            pnlUSDT: 1486.38,
            roePct: 2278.93,
        },
        {
            platform: 'binance',
            leadId,
            fetchedAt: now,
            symbol: 'ETHUSDT',
            side: 'LONG',
            contractType: 'PERP',
            leverage: 50,
            size: 1.5,
            sizeAsset: 'ETH',
            entryPrice: 2850.00,
            markPrice: 2920.00,
            marginUSDT: 85.50,
            marginType: 'CROSS',
            pnlUSDT: 105.00,
            roePct: 122.81,
        },
    ];

    for (const pos of positions) {
        await prisma.positionSnapshot.create({ data: pos });
    }
    console.log(`✅ Created ${positions.length} position snapshots`);

    // Create sample events
    const events = [
        {
            platform: 'binance',
            leadId,
            eventKey: `binance|${leadId}|OPEN_SHORT|BTCUSDT|02-04, 18:30:15|0.108|86232.48`,
            eventType: 'OPEN_SHORT',
            symbol: 'BTCUSDT',
            eventTimeText: '02-04, 18:30:15',
            eventTime: new Date('2026-02-04T18:30:15Z'),
            price: 86232.48,
            amount: 0.108,
            amountAsset: 'BTC',
            realizedPnl: null,
            fetchedAt: now,
        },
        {
            platform: 'binance',
            leadId,
            eventKey: `binance|${leadId}|OPEN_LONG|ETHUSDT|02-04, 19:15:22|1.5|2850.00`,
            eventType: 'OPEN_LONG',
            symbol: 'ETHUSDT',
            eventTimeText: '02-04, 19:15:22',
            eventTime: new Date('2026-02-04T19:15:22Z'),
            price: 2850.00,
            amount: 1.5,
            amountAsset: 'ETH',
            realizedPnl: null,
            fetchedAt: now,
        },
        {
            platform: 'binance',
            leadId,
            eventKey: `binance|${leadId}|CLOSE_LONG|HYPEUSDT|02-04, 20:05:10|25.36|36.50`,
            eventType: 'CLOSE_LONG',
            symbol: 'HYPEUSDT',
            eventTimeText: '02-04, 20:05:10',
            eventTime: new Date('2026-02-04T20:05:10Z'),
            price: 36.50,
            amount: 25.36,
            amountAsset: 'HYPE',
            realizedPnl: 150.25,
            fetchedAt: now,
        },
        {
            platform: 'binance',
            leadId,
            eventKey: `binance|${leadId}|OPEN_LONG|HYPEUSDT|02-04, 22:52:35|25.36|35.005`,
            eventType: 'OPEN_LONG',
            symbol: 'HYPEUSDT',
            eventTimeText: '02-04, 22:52:35',
            eventTime: new Date('2026-02-04T22:52:35Z'),
            price: 35.005,
            amount: 25.36,
            amountAsset: 'HYPE',
            realizedPnl: null,
            fetchedAt: now,
        },
    ];

    for (const event of events) {
        try {
            await prisma.event.create({ data: event });
        } catch {
            console.log(`⚠️ Skipped duplicate event: ${event.eventKey}`);
        }
    }
    console.log(`✅ Created ${events.length} events`);

    // Create symbol aggregations
    const aggregations = [
        {
            platform: 'binance',
            symbol: 'BTCUSDT',
            openLongCount: 0,
            openShortCount: 1,
            totalOpen: 1,
            latestEventAt: new Date('2026-02-04T18:30:15Z'),
        },
        {
            platform: 'binance',
            symbol: 'ETHUSDT',
            openLongCount: 1,
            openShortCount: 0,
            totalOpen: 1,
            latestEventAt: new Date('2026-02-04T19:15:22Z'),
        },
        {
            platform: 'binance',
            symbol: 'HYPEUSDT',
            openLongCount: 0,
            openShortCount: 0,
            totalOpen: 0,
            latestEventAt: new Date('2026-02-04T22:52:35Z'),
        },
    ];

    for (const agg of aggregations) {
        await prisma.symbolAggregation.upsert({
            where: { platform_symbol: { platform: agg.platform, symbol: agg.symbol } },
            update: agg,
            create: agg,
        });
    }
    console.log(`✅ Created ${aggregations.length} symbol aggregations`);

    // Create trader score
    await prisma.traderScore.upsert({
        where: { leadId },
        update: { score30d: 54.5 },
        create: {
            leadId,
            platform: 'binance',
            score30d: 54.5, // Based on ~$150 realized PnL
        },
    });
    console.log(`✅ Created trader score`);

    console.log('\n✨ Seed completed!');
    console.log(`
Test the API with:
  curl http://localhost:3000/health
  curl http://localhost:3000/symbols
  curl http://localhost:3000/traders/top
  curl http://localhost:3000/traders/${leadId}/positions
  `);
}

seed()
    .catch((error) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
