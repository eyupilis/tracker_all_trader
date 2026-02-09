-- CreateTable
CREATE TABLE "SimulatedPosition" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'binance',
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "leverage" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "marginNotional" DOUBLE PRECISION NOT NULL,
    "positionNotional" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "pnlUSDT" DOUBLE PRECISION,
    "roiPct" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "closeReason" TEXT,
    "closeTriggerLeadId" TEXT,
    "closeTriggerEventType" TEXT,
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatedPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulatedPosition_platform_status_openedAt_idx" ON "SimulatedPosition"("platform", "status", "openedAt" DESC);

-- CreateIndex
CREATE INDEX "SimulatedPosition_symbol_status_idx" ON "SimulatedPosition"("symbol", "status");
