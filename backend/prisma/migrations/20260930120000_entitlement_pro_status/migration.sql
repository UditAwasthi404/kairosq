ALTER TABLE "entitlements" ADD COLUMN "isPro" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "entitlements" ADD COLUMN "store" TEXT;
ALTER TABLE "entitlements" ADD COLUMN "productId" TEXT;
ALTER TABLE "entitlements" ADD COLUMN "lastEventAt" TIMESTAMP(3);

UPDATE "entitlements"
SET "isPro" = true
WHERE "status" IN ('active', 'trial', 'grace')
  AND ("validUntil" IS NULL OR "validUntil" > CURRENT_TIMESTAMP);
