-- CreateEnum
CREATE TYPE "EntitlementFeature" AS ENUM ('RECALL');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('inactive', 'trial', 'active', 'grace', 'expired', 'revoked');

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "EntitlementFeature" NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'inactive',
    "validUntil" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'stub',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recall_event_receipts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "observationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recall_event_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entitlements_userId_feature_status_idx" ON "entitlements"("userId", "feature", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_userId_feature_key" ON "entitlements"("userId", "feature");

-- CreateIndex
CREATE INDEX "recall_event_receipts_userId_fingerprint_createdAt_idx" ON "recall_event_receipts"("userId", "fingerprint", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "recall_event_receipts_userId_clientEventId_key" ON "recall_event_receipts"("userId", "clientEventId");

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recall_event_receipts" ADD CONSTRAINT "recall_event_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
