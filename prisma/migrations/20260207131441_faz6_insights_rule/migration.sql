-- CreateTable
CREATE TABLE "InsightsRule" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "platform" TEXT NOT NULL DEFAULT 'binance',
    "defaultMode" TEXT NOT NULL DEFAULT 'balanced',
    "conservativePreset" JSONB NOT NULL,
    "balancedPreset" JSONB NOT NULL,
    "aggressivePreset" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightsRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsightsRule_platform_idx" ON "InsightsRule"("platform");
