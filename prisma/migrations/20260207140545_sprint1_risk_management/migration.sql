-- AlterTable
ALTER TABLE "SimulatedPosition" ADD COLUMN     "commissionBps" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "effectiveEntryPrice" DOUBLE PRECISION,
ADD COLUMN     "effectiveExitPrice" DOUBLE PRECISION,
ADD COLUMN     "lastPriceCheckAt" TIMESTAMP(3),
ADD COLUMN     "lastPriceUpdate" DOUBLE PRECISION,
ADD COLUMN     "portfolioId" TEXT,
ADD COLUMN     "riskModel" TEXT,
ADD COLUMN     "riskPercentage" DOUBLE PRECISION,
ADD COLUMN     "slippageBps" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "stopLossPrice" DOUBLE PRECISION,
ADD COLUMN     "takeProfitPrice" DOUBLE PRECISION,
ADD COLUMN     "totalCommissionUSDT" DOUBLE PRECISION,
ADD COLUMN     "trailingStopPct" DOUBLE PRECISION,
ADD COLUMN     "trailingStopTrigger" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'binance',
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "maxRiskPerTrade" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "maxPortfolioRisk" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "maxOpenPositions" INTEGER NOT NULL DEFAULT 5,
    "maxLeverageAllowed" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "defaultSlippageBps" INTEGER NOT NULL DEFAULT 10,
    "defaultCommissionBps" INTEGER NOT NULL DEFAULT 4,
    "kellyFraction" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "minSampleSize" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "balance" DOUBLE PRECISION NOT NULL,
    "unrealizedPnl" DOUBLE PRECISION NOT NULL,
    "realizedPnl" DOUBLE PRECISION NOT NULL,
    "totalPnl" DOUBLE PRECISION NOT NULL,
    "openPositions" INTEGER NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioMetric" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "losingTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgWin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxConsecLosses" INTEGER NOT NULL DEFAULT 0,
    "maxConsecWins" INTEGER NOT NULL DEFAULT 0,
    "avgSlippageBps" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Portfolio_platform_idx" ON "Portfolio"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_platform_name_key" ON "Portfolio"("platform", "name");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_portfolioId_snapshotAt_idx" ON "PortfolioSnapshot"("portfolioId", "snapshotAt" DESC);

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_snapshotAt_idx" ON "PortfolioSnapshot"("snapshotAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioMetric_portfolioId_key" ON "PortfolioMetric"("portfolioId");

-- CreateIndex
CREATE INDEX "SimulatedPosition_status_lastPriceCheckAt_idx" ON "SimulatedPosition"("status", "lastPriceCheckAt");

-- CreateIndex
CREATE INDEX "SimulatedPosition_portfolioId_status_idx" ON "SimulatedPosition"("portfolioId", "status");

-- Create default portfolio for existing positions
INSERT INTO "Portfolio" (id, name, platform, "initialBalance", "currentBalance", "createdAt", "updatedAt")
VALUES ('default', 'Default', 'binance', 10000, 10000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Assign all existing SimulatedPositions to default portfolio
UPDATE "SimulatedPosition" SET "portfolioId" = 'default' WHERE "portfolioId" IS NULL;

-- AddForeignKey
ALTER TABLE "SimulatedPosition" ADD CONSTRAINT "SimulatedPosition_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioMetric" ADD CONSTRAINT "PortfolioMetric_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
