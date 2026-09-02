-- Stage 4.1 — pgvector hybrid search: manual SQL setup (NOT managed by Prisma).
--
-- Why this file exists:
--   * Prisma 7 cannot auto-create the pgvector `vector` extension.
--   * The `embedding` column is mapped as Unsupported("vector(1536)"), so Prisma
--     never introspects its dimension or manages indexes over it.
--   * The tsvector GIN index over searchText is a functional index that Prisma
--     cannot express in the schema.
--
-- Run these once against the target database (e.g. source them via a migration
-- or a one-off psql/Neon SQL editor).

-- 1. Enable the pgvector extension.
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Full-text index over the denormalized searchText column (English config).
--    `searchText` itself is a plain String? column managed by Prisma schema.
CREATE INDEX IF NOT EXISTS "Asset_searchText_tsv_idx"
  ON "Asset"
  USING gin (to_tsvector('english', coalesce("searchText", '')));

-- 3. Approximate-nearest-neighbor index for the semantic vector.
--    Dims are 1536 (gemini-embedding-001's 3072 down-projected to 1536), which
--    is within pgvector's 2000-dim HNSW ceiling. MUST be created AFTER the
--    column is populated with vectors, or the index build has nothing to index.
CREATE INDEX IF NOT EXISTS "Asset_embedding_hnsw_idx"
  ON "Asset"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Tune recall/latency for a given query workload if needed:
--    SET hnsw.ef_search = 40;
