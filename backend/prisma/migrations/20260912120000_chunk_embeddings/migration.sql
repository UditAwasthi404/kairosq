-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Processing status for embedding stage
ALTER TYPE "ProcessingStatus" ADD VALUE IF NOT EXISTS 'EMBEDDING';

-- Embedding columns on chunks (dimension must match EMBEDDING_DIMENSIONS=1536)
ALTER TABLE "observation_chunks"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536),
  ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT,
  ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMP(3);

-- Cosine distance index for similarity search (OpenAI embeddings are L2-normalized)
CREATE INDEX IF NOT EXISTS "observation_chunks_embedding_hnsw_idx"
  ON "observation_chunks"
  USING hnsw ("embedding" vector_cosine_ops);
