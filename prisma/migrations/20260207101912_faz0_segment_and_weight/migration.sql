-- AlterTable
ALTER TABLE "LeadTrader" ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "posShowUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "positionShow" BOOLEAN;

-- AlterTable
ALTER TABLE "TraderScore" ADD COLUMN     "confidence" TEXT,
ADD COLUMN     "qualityScore" INTEGER,
ADD COLUMN     "sampleSize" INTEGER,
ADD COLUMN     "traderWeight" DOUBLE PRECISION,
ADD COLUMN     "winRate" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "LeadTrader_platform_positionShow_idx" ON "LeadTrader"("platform", "positionShow");

-- CreateIndex
CREATE INDEX "TraderScore_platform_traderWeight_idx" ON "TraderScore"("platform", "traderWeight" DESC);
