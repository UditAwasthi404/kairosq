-- AlterEnum
ALTER TYPE "ProcessingStatus" ADD VALUE IF NOT EXISTS 'EXTRACTING';
ALTER TYPE "ProcessingStatus" ADD VALUE IF NOT EXISTS 'NORMALIZING';
ALTER TYPE "ProcessingStatus" ADD VALUE IF NOT EXISTS 'CHUNKING';
ALTER TYPE "ProcessingStatus" ADD VALUE IF NOT EXISTS 'ANALYZING';

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'ORGANIZATION', 'TECHNOLOGY', 'PRODUCT', 'LOCATION', 'CONCEPT');

-- AlterTable
ALTER TABLE "observations" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "observations" ADD COLUMN IF NOT EXISTS "pageCount" INTEGER;
ALTER TABLE "observations" ADD COLUMN IF NOT EXISTS "characterCount" INTEGER;
ALTER TABLE "observations" ADD COLUMN IF NOT EXISTS "wordCount" INTEGER;
ALTER TABLE "observations" ADD COLUMN IF NOT EXISTS "chunkCount" INTEGER;

-- CreateTable
CREATE TABLE "observation_chunks" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_topics" (
    "observationId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_topics_pkey" PRIMARY KEY ("observationId","topicId")
);

-- CreateTable
CREATE TABLE "observation_entities" (
    "observationId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_entities_pkey" PRIMARY KEY ("observationId","entityId")
);

-- CreateIndex
CREATE UNIQUE INDEX "observation_chunks_observationId_chunkIndex_key" ON "observation_chunks"("observationId", "chunkIndex");

-- CreateIndex
CREATE INDEX "observation_chunks_observationId_idx" ON "observation_chunks"("observationId");

-- CreateIndex
CREATE INDEX "topics_userId_idx" ON "topics"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "topics_userId_normalizedName_key" ON "topics"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "entities_userId_idx" ON "entities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "entities_userId_normalizedName_type_key" ON "entities"("userId", "normalizedName", "type");

-- AddForeignKey
ALTER TABLE "observation_chunks" ADD CONSTRAINT "observation_chunks_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_topics" ADD CONSTRAINT "observation_topics_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_topics" ADD CONSTRAINT "observation_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_entities" ADD CONSTRAINT "observation_entities_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_entities" ADD CONSTRAINT "observation_entities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
