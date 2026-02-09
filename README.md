# Copy-Trading Position Aggregator Backend

A high-performance backend API for aggregating Binance Copy Trading positions and events. Built with Node.js 20, TypeScript, Fastify, PostgreSQL, and Prisma.

## Features

- **Ingest API**: Receive positions and events from n8n scraper
- **Deduplication**: Events are deduplicated using unique `event_key`
- **Aggregations**: Real-time symbol aggregations by position counts
- **Trader Scoring**: MVP scoring based on realized PnL
- **OpenAPI/Swagger**: Auto-generated API documentation
- **Rate Limiting**: Protect ingest endpoints
- **API Key Auth**: Simple authentication for ingest

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify 4
- **Database**: PostgreSQL 16 + Prisma ORM
- **Validation**: Zod
- **Docs**: OpenAPI/Swagger
- **Containerization**: Docker + docker-compose

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### 1. Clone and Install

```bash
cd binance_copy_trader_tracker
npm install
```

### 2. Start PostgreSQL

```bash
docker-compose up -d postgres
```

### 3. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:dev
```

### 4. Start Development Server

```bash
npm run dev
```

The API will be available at:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health

### 5. (Optional) Seed Sample Data

```bash
npm run seed
```

### n8n Connection (ngrok)

`n8n_real_workflow.json` is configured for ngrok mode:
- `backendBaseUrl` uses:
  - `={{ $env.N8N_BACKEND_BASE_URL || "https://set-N8N_BACKEND_BASE_URL.invalid" }}`
- Set `N8N_BACKEND_BASE_URL` in n8n to your active ngrok HTTPS URL.
- If unset, requests fail fast against `.invalid` (prevents silent localhost fallback).

ngrok mode:
1. Start backend: `npm run start`
2. Start tunnel: `ngrok http 3000`
3. Sync workflow URL automatically:
   - `npm run n8n:sync-ngrok`
4. Set n8n env var:
   - `N8N_BACKEND_BASE_URL=https://<your-ngrok-domain>.ngrok-free.app`

This updates `n8n_real_workflow.json` `backendBaseUrl` to the current ngrok `public_url`, so you do not hit stale `ERR_NGROK_3200` URLs.

## Production Deployment

### Using Docker Compose

```bash
# Set API key
export INGEST_API_KEY=your-secure-key-here

# Build and start all services
docker-compose up -d

# Run migrations
docker-compose run --rm migrate
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `INGEST_API_KEY` | API key for ingest endpoints | - |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `60000` |

## API Reference

### Authentication

Ingest endpoints require the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" ...
```

### Endpoints

#### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T00:05:00.000Z",
  "uptime": 3600.5
}
```

---

#### Ingest Positions & Events (Protected)

```bash
POST /ingest/binance-copytrade
```

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Body:**
```json
{
  "leadId": "4681698170884314113",
  "fetchedAt": "2026-02-05T00:05:00.000Z",
  "positions": [
    {
      "platform": "binance",
      "leadId": "4681698170884314113",
      "symbol": "BTCUSDT",
      "contractType": "PERP",
      "leverage": 120,
      "size": -0.108,
      "sizeAsset": "BTC",
      "side": "SHORT",
      "entryPrice": 86232.48,
      "markPrice": 72469.70,
      "marginUSDT": 65.22,
      "marginType": "CROSS",
      "pnlUSDT": 1486.38,
      "roePct": 2278.93,
      "fetchedAt": "2026-02-05T00:05:00.000Z"
    }
  ],
  "events": [
    {
      "platform": "binance",
      "leadId": "4681698170884314113",
      "eventTimeText": "02-04, 22:52:35",
      "eventType": "OPEN_LONG",
      "symbol": "HYPEUSDT",
      "price": 35.005,
      "amount": 25.36,
      "amountAsset": "HYPE",
      "realizedPnl": null,
      "fetchedAt": "2026-02-05T00:05:00.000Z",
      "event_key": "binance|4681698170884314113|OPEN_LONG|HYPEUSDT|02-04, 22:52:35|25.36|35.005"
    }
  ]
}
```

**Example curl:**
```bash
curl -X POST http://localhost:3000/ingest/binance-copytrade \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "leadId": "4681698170884314113",
    "fetchedAt": "2026-02-05T00:05:00.000Z",
    "positions": [
      {
        "platform": "binance",
        "leadId": "4681698170884314113",
        "symbol": "BTCUSDT",
        "side": "SHORT",
        "leverage": 120,
        "size": -0.108,
        "sizeAsset": "BTC",
        "entryPrice": 86232.48,
        "markPrice": 72469.70,
        "marginUSDT": 65.22,
        "pnlUSDT": 1486.38,
        "roePct": 2278.93,
        "fetchedAt": "2026-02-05T00:05:00.000Z"
      }
    ],
    "events": [
      {
        "platform": "binance",
        "leadId": "4681698170884314113",
        "eventTimeText": "02-04, 22:52:35",
        "eventType": "OPEN_LONG",
        "symbol": "HYPEUSDT",
        "price": 35.005,
        "amount": 25.36,
        "amountAsset": "HYPE",
        "fetchedAt": "2026-02-05T00:05:00.000Z",
        "event_key": "binance|4681698170884314113|OPEN_LONG|HYPEUSDT|02-04, 22:52:35|25.36|35.005"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leadId": "4681698170884314113",
    "positionsInserted": 1,
    "eventsInserted": 1,
    "eventsSkipped": 0,
    "symbolsAggregated": 2,
    "traderScore": 54.5
  }
}
```

---

#### Get Symbols

```bash
GET /symbols?platform=binance&limit=50&offset=0
```

**Example curl:**
```bash
curl "http://localhost:3000/symbols?platform=binance&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTCUSDT",
      "openLongCount": 15,
      "openShortCount": 8,
      "totalOpen": 23,
      "latestEventAt": "2026-02-05T00:05:00.000Z"
    }
  ],
  "meta": {
    "total": 45,
    "limit": 50,
    "offset": 0
  }
}
```

---

#### Get Symbol Feed

```bash
GET /symbols/:symbol/feed?platform=binance&limit=50
```

**Example curl:**
```bash
curl "http://localhost:3000/symbols/BTCUSDT/feed?limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "eventType": "OPEN_SHORT",
      "eventTimeText": "02-04, 22:52:35",
      "eventTime": "2026-02-04T22:52:35.000Z",
      "leadId": "4681698170884314113",
      "price": 86232.48,
      "amount": 0.108,
      "realizedPnl": null,
      "eventKey": "binance|4681698170884314113|OPEN_SHORT|BTCUSDT|..."
    }
  ]
}
```

---

#### Get Top Traders

```bash
GET /traders/top?platform=binance&range=30d&limit=50
```

**Example curl:**
```bash
curl "http://localhost:3000/traders/top?limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "leadId": "4681698170884314113",
      "score30d": 87.5
    }
  ]
}
```

---

#### Get Trader Positions

```bash
GET /traders/:leadId/positions?platform=binance
```

**Example curl:**
```bash
curl "http://localhost:3000/traders/4681698170884314113/positions"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "symbol": "BTCUSDT",
      "side": "SHORT",
      "leverage": 120,
      "size": -0.108,
      "sizeAsset": "BTC",
      "entryPrice": 86232.48,
      "markPrice": 72469.70,
      "marginUSDT": 65.22,
      "pnlUSDT": 1486.38,
      "roePct": 2278.93,
      "fetchedAt": "2026-02-05T00:05:00.000Z"
    }
  ],
  "meta": {
    "leadId": "4681698170884314113",
    "positionCount": 1,
    "fetchedAt": "2026-02-05T00:05:00.000Z"
  }
}
```

---

#### Get Trader Info

```bash
GET /traders/:leadId
```

**Example curl:**
```bash
curl "http://localhost:3000/traders/4681698170884314113"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leadId": "4681698170884314113",
    "platform": "binance",
    "score30d": 54.5,
    "createdAt": "2026-02-05T00:00:00.000Z",
    "updatedAt": "2026-02-05T00:05:00.000Z"
  }
}
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                         LeadTrader                               │
├─────────────────────────────────────────────────────────────────┤
│ id (PK)  │  platform  │  createdAt  │  updatedAt                │
└─────────────────────────────────────────────────────────────────┘
           │
           ├──────────────────────┐
           │                      │
           ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  PositionSnapshot   │  │       Event         │  │    TraderScore      │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ id (PK)             │  │ id (PK)             │  │ leadId (PK, FK)     │
│ leadId (FK)         │  │ leadId (FK)         │  │ platform            │
│ symbol              │  │ eventKey (unique)   │  │ score30d            │
│ side                │  │ eventType           │  │ updatedAt           │
│ leverage            │  │ symbol              │  └─────────────────────┘
│ size                │  │ eventTime           │
│ entryPrice          │  │ price               │
│ markPrice           │  │ amount              │
│ pnlUSDT             │  │ realizedPnl         │
│ fetchedAt           │  │ fetchedAt           │
└─────────────────────┘  └─────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      SymbolAggregation                          │
├─────────────────────────────────────────────────────────────────┤
│ id │ platform │ symbol │ openLong │ openShort │ totalOpen │ ... │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
binance_copy_trader_tracker/
├── prisma/
│   └── schema.prisma        # Database schema
├── scripts/
│   └── seed.ts              # Sample data seeder
├── src/
│   ├── db/
│   │   └── prisma.ts        # Prisma client singleton
│   ├── middleware/
│   │   └── auth.ts          # API key authentication
│   ├── routes/
│   │   ├── health.ts        # Health check
│   │   ├── ingest.ts        # Ingest endpoint
│   │   ├── symbols.ts       # Symbol queries
│   │   └── traders.ts       # Trader queries
│   ├── schemas/
│   │   └── ingest.ts        # Zod validation schemas
│   ├── services/
│   │   ├── aggregation.ts   # Symbol aggregation logic
│   │   ├── event.ts         # Event handling
│   │   ├── leadTrader.ts    # Lead trader CRUD
│   │   ├── position.ts      # Position snapshots
│   │   └── traderScore.ts   # Scoring logic
│   ├── types/
│   │   └── index.ts         # Shared types
│   ├── app.ts               # Fastify app setup
│   ├── config.ts            # Environment config
│   └── index.ts             # Entry point
├── .env                     # Environment variables
├── .env.example             # Example env file
├── docker-compose.yml       # Docker services
├── Dockerfile               # App container
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Commands

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database commands
npm run db:generate       # Generate Prisma client
npm run db:migrate:dev    # Create & run migrations (dev)
npm run db:migrate        # Run migrations (prod)
npm run db:studio         # Open Prisma Studio

# Seed sample data
npm run seed
```

### Adding a New Lead Trader

The system automatically creates lead traders when you ingest data. Simply POST to `/ingest/binance-copytrade` with a new `leadId`.

## License

MIT
