-- CreateTable
CREATE TABLE "AutoTriggerRule" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "platform" TEXT NOT NULL DEFAULT 'binance',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "segment" TEXT NOT NULL DEFAULT 'VISIBLE',
    "timeRange" TEXT NOT NULL DEFAULT '24h',
    "minTraders" INTEGER NOT NULL DEFAULT 2,
    "minConfidence" INTEGER NOT NULL DEFAULT 40,
    "minSentimentAbs" INTEGER NOT NULL DEFAULT 20,
    "leverage" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "marginNotional" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoTriggerRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoTriggerRule_platform_idx" ON "AutoTriggerRule"("platform");
