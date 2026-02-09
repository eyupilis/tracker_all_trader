-- CreateTable
CREATE TABLE "RawIngest" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'binance',
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positionsCount" INTEGER,
    "ordersCount" INTEGER,
    "timeRange" TEXT,

    CONSTRAINT "RawIngest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawIngest_leadId_fetchedAt_idx" ON "RawIngest"("leadId", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "RawIngest_platform_createdAt_idx" ON "RawIngest"("platform", "createdAt" DESC);
