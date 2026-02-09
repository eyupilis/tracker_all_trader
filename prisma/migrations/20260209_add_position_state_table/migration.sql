-- CreateTable
CREATE TABLE "PositionState" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'binance',
    "leadId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "leverage" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "estimatedOpenTime" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "exitPrice" DOUBLE PRECISION,
    "closedBy" TEXT,
    "pnl" DOUBLE PRECISION,
    "roi" DOUBLE PRECISION,
    "holdDurationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PositionState_leadId_symbol_idx" ON "PositionState"("leadId", "symbol");

-- CreateIndex
CREATE INDEX "PositionState_leadId_status_idx" ON "PositionState"("leadId", "status");

-- CreateIndex
CREATE INDEX "PositionState_symbol_status_idx" ON "PositionState"("symbol", "status");

-- CreateIndex
CREATE INDEX "PositionState_firstSeenAt_idx" ON "PositionState"("firstSeenAt" DESC);
