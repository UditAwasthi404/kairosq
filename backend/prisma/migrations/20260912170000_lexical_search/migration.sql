-- Lexical retrieval support for hybrid search (Phase 2)
-- Uses PostgreSQL native FTS (simple config) + pg_trgm for filenames.
--
-- Why `simple` instead of `english`:
--   Technical tokens (Redis, maxmemory, allkeys-lru) must not be stemmed away.
-- Why expression GIN on chunk content:
--   Content is the primary lexical corpus; filename is joined at query time and
--   also matched via trigram ILIKE for exact file lookups.
-- Why pg_trgm on originalFilename:
--   Filename queries (e.g. redis-production-config.pdf) are not embedded today;
--   trigram enables efficient substring matches without a separate search engine.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "observation_chunks_content_fts_idx"
  ON "observation_chunks"
  USING GIN (to_tsvector('simple', content));

CREATE INDEX IF NOT EXISTS "observations_original_filename_trgm_idx"
  ON "observations"
  USING GIN ("originalFilename" gin_trgm_ops);
