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
    "disappearedAt" TIMESTAMP(3),
    "estimatedOpenTime" TIMESTAMP(3),
    "estimatedCloseTime" TIMESTAMP(3),
    "openEventId" TEXT,
    "closeEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PositionState_platform_leadId_symbol_direction_firstSeenAt_key" ON "PositionState"("platform", "leadId", "symbol", "direction", "firstSeenAt");

-- CreateIndex
CREATE INDEX "PositionState_platform_leadId_status_idx" ON "PositionState"("platform", "leadId", "status");

-- CreateIndex
CREATE INDEX "PositionState_symbol_status_idx" ON "PositionState"("symbol", "status");

-- CreateIndex
CREATE INDEX "PositionState_status_lastSeenAt_idx" ON "PositionState"("status", "lastSeenAt" DESC);
