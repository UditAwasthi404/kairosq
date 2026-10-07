-- CreateEnum
CREATE TYPE "CaptureSource" AS ENUM ('MANUAL', 'KEYBOARD', 'SHARE', 'QUICK_CAPTURE', 'VOICE', 'WIDGET', 'RECALL');

-- AlterEnum
ALTER TYPE "ObservationType" ADD VALUE 'AUDIO';

-- AlterTable
ALTER TABLE "observations" ADD COLUMN "source" "CaptureSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX "observations_userId_source_idx" ON "observations"("userId", "source");
