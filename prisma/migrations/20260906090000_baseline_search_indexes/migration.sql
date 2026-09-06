-- Baseline reconcilation of pre-existing schema drift that was applied out of
-- band (prisma db push / prisma/vector-setup.sql) before Auth.js integration:
-- Asset.embedding (pgvector), Asset.searchText, plus the hand-tuned indexes
-- Prisma cannot express (HNSW + tsvector GIN). Marked applied via
-- `prisma migrate resolve --applied` so `migrate dev` stops demanding a reset.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Asset" ADD COLUMN "embedding" vector(1536);
ALTER TABLE "Asset" ADD COLUMN "searchText" TEXT;

CREATE INDEX "Asset_searchText_idx" ON "Asset" ("searchText");

CREATE INDEX "Asset_embedding_hnsw_idx" ON "Asset"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = '16', ef_construction = '64');

CREATE INDEX "Asset_searchText_tsv_idx" ON "Asset"
  USING gin (to_tsvector('english'::regconfig, COALESCE("searchText", ''::text)));