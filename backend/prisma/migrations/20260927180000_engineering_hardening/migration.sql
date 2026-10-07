-- List queries order by capturedAt
CREATE INDEX IF NOT EXISTS "observations_userId_capturedAt_idx"
  ON "observations" ("userId", "capturedAt" DESC);

CREATE INDEX IF NOT EXISTS "observation_topics_topicId_idx"
  ON "observation_topics" ("topicId");

CREATE INDEX IF NOT EXISTS "observation_entities_entityId_idx"
  ON "observation_entities" ("entityId");

-- Recall receipts → observations (orphans keep the receipt)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recall_event_receipts_observationId_fkey'
  ) THEN
    ALTER TABLE "recall_event_receipts"
      ADD CONSTRAINT "recall_event_receipts_observationId_fkey"
      FOREIGN KEY ("observationId") REFERENCES "observations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TYPE "ObservationJobKind" AS ENUM ('PROCESS', 'REINDEX', 'NOTIFY');
CREATE TYPE "ObservationJobStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS "observation_jobs" (
  "id" TEXT NOT NULL,
  "observationId" TEXT NOT NULL,
  "kind" "ObservationJobKind" NOT NULL,
  "status" "ObservationJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockToken" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "observation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "observation_jobs_status_availableAt_idx"
  ON "observation_jobs" ("status", "availableAt");

CREATE INDEX IF NOT EXISTS "observation_jobs_observationId_kind_status_idx"
  ON "observation_jobs" ("observationId", "kind", "status");

CREATE TABLE IF NOT EXISTS "rate_limit_events" (
  "id" TEXT NOT NULL,
  "bucketKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rate_limit_events_bucketKey_createdAt_idx"
  ON "rate_limit_events" ("bucketKey", "createdAt");
