ALTER TABLE "observations"
ADD COLUMN "clientCaptureId" TEXT;

CREATE UNIQUE INDEX "observations_userId_clientCaptureId_key"
ON "observations"("userId", "clientCaptureId");
