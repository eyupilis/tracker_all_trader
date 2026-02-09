-- AlterTable: Add missing columns to PositionState
ALTER TABLE "PositionState" ADD COLUMN "disappearedAt" TIMESTAMP(3);
ALTER TABLE "PositionState" ADD COLUMN "estimatedCloseTime" TIMESTAMP(3);
ALTER TABLE "PositionState" ADD COLUMN "openEventId" TEXT;
ALTER TABLE "PositionState" ADD COLUMN "closeEventId" TEXT;

-- CreateIndex: Add unique constraint
CREATE UNIQUE INDEX "PositionState_platform_leadId_symbol_direction_firstSeenAt_key"
ON "PositionState"("platform", "leadId", "symbol", "direction", "firstSeenAt");
