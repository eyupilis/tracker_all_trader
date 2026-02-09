-- CreateTable
CREATE TABLE "LeadTrader" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'binance',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadTrader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionSnapshot" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "contractType" TEXT,
    "leverage" INTEGER,
    "size" DOUBLE PRECISION NOT NULL,
    "sizeAsset" TEXT,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "markPrice" DOUBLE PRECISION,
    "marginUSDT" DOUBLE PRECISION,
    "marginType" TEXT,
    "pnlUSDT" DOUBLE PRECISION,
    "roePct" DOUBLE PRECISION,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "eventTimeText" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3),
    "price" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "amountAsset" TEXT,
    "realizedPnl" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymbolAggregation" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openLongCount" INTEGER NOT NULL DEFAULT 0,
    "openShortCount" INTEGER NOT NULL DEFAULT 0,
    "totalOpen" INTEGER NOT NULL DEFAULT 0,
    "latestEventAt" TIMESTAMP(3),
    "latestEventKey" TEXT,

    CONSTRAINT "SymbolAggregation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraderScore" (
    "leadId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'binance',
    "score30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraderScore_pkey" PRIMARY KEY ("leadId")
);

-- CreateIndex
CREATE INDEX "LeadTrader_platform_idx" ON "LeadTrader"("platform");

-- CreateIndex
CREATE INDEX "PositionSnapshot_platform_symbol_idx" ON "PositionSnapshot"("platform", "symbol");

-- CreateIndex
CREATE INDEX "PositionSnapshot_leadId_fetchedAt_idx" ON "PositionSnapshot"("leadId", "fetchedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Event_eventKey_key" ON "Event"("eventKey");

-- CreateIndex
CREATE INDEX "Event_symbol_eventTime_idx" ON "Event"("symbol", "eventTime" DESC);

-- CreateIndex
CREATE INDEX "Event_leadId_eventTime_idx" ON "Event"("leadId", "eventTime" DESC);

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "SymbolAggregation_platform_totalOpen_idx" ON "SymbolAggregation"("platform", "totalOpen" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SymbolAggregation_platform_symbol_key" ON "SymbolAggregation"("platform", "symbol");

-- CreateIndex
CREATE INDEX "TraderScore_platform_score30d_idx" ON "TraderScore"("platform", "score30d" DESC);

-- AddForeignKey
ALTER TABLE "PositionSnapshot" ADD CONSTRAINT "PositionSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadTrader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadTrader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderScore" ADD CONSTRAINT "TraderScore_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadTrader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
