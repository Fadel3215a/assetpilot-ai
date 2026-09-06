import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { indexAsset } from "@/lib/search";
import {
  toDomainActivity,
  toDomainAsset,
  toDomainCollection,
  toDomainComparison,
  toDomainFeedback,
} from "@/lib/server/mappers";
import type {
  ActivityItem,
  Asset,
  AssetSearchHit,
  Collection,
  ComparisonRecord,
  CuratorFeedbackEntry,
} from "@/types";

export async function getCollections(): Promise<Collection[]> {
  const rows = await prisma.collection.findMany({ orderBy: { name: "asc" } });
  return rows.map(toDomainCollection);
}

export async function getAssets(): Promise<Asset[]> {
  const rows = await prisma.asset.findMany({
    include: { versions: true, decisionHistory: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toDomainAsset);
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const row = await prisma.asset.findUnique({
    where: { id },
    include: { versions: true, decisionHistory: true },
  });
  return row ? toDomainAsset(row) : null;
}

export async function getActivity(): Promise<ActivityItem[]> {
  const rows = await prisma.activityItem.findMany({
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  });
  return rows.map(toDomainActivity);
}

export async function getComparisons(): Promise<ComparisonRecord[]> {
  const rows = await prisma.comparisonRecord.findMany({
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  });
  return rows.map(toDomainComparison);
}

export async function getFeedbackEntries(): Promise<CuratorFeedbackEntry[]> {
  const rows = await prisma.curatorFeedbackEntry.findMany({
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  });
  return rows.map(toDomainFeedback);
}

export async function getIgnoredDuplicateIds(): Promise<string[]> {
  const rows = await prisma.ignoredDuplicate.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => row.duplicateId);
}

export interface HybridSearchOptions {
  query: string;
  collectionId?: string;
  limit?: number;
  threshold?: number;
}

export interface HybridSearchResult {
  assets: Asset[];
  hits: AssetSearchHit[];
}

interface HybridScoreRow {
  id: string;
  vectorScore: number;
  textScore: number;
  score: number;
}

/**
 * Stage 4.1 — Hybrid vector + full-text search.
 *
 * Single `$queryRaw` pass over the indexed rows that fuses two signals:
 *   - vector cosine similarity  `1 - ("embedding" <=> $1::vector)`  (pgvector)
 *   - full-text rank            `ts_rank(to_tsvector('english', …), plainto_tsquery(…))`
 *
 * The raw full-text rank is normalized against the best FTS match in the
 * candidate set so both signals land in [0, 1] before the weighted fusion
 * (0.55 vector / 0.45 text by default — tunable via caller-supplied weighting
 * through the threshold). Rows below `threshold`, or outside `collectionId`,
 * are excluded. Score rows are mapped back to full typed `Asset` domain
 * objects (with versions + decision history) in ranked order.
 *
 * Unindexed rows (missing `searchText`/`embedding`) are naturally skipped.
 */
export async function hybridSearchAssets({
  query,
  collectionId,
  limit = 12,
  threshold = 0,
}: HybridSearchOptions): Promise<HybridSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { assets: [], hits: [] };

  const embedding = await generateEmbedding(trimmed);
  const vectorLiteral = `[${embedding.join(",")}]`;
  const collectionFilter = collectionId?.trim() || null;

  const rows = await prisma.$queryRaw<HybridScoreRow[]>`
    WITH scored AS (
      SELECT a."id",
             1 - (a."embedding" <=> ${vectorLiteral}::vector) AS "vectorScore",
             ts_rank(
               to_tsvector('english', coalesce(a."searchText", '')),
               plainto_tsquery('english', ${trimmed})
             ) AS "textRank"
      FROM "Asset" a
      WHERE a."embedding" IS NOT NULL
        AND a."searchText" IS NOT NULL
        AND (${collectionFilter}::text IS NULL OR a."collectionId" = ${collectionFilter})
    ),
    normalized AS (
      SELECT s."id",
             s."vectorScore",
             CASE
               WHEN s."textRank" > 0
               THEN s."textRank" / NULLIF((SELECT max(x."textRank") FROM scored x), 0)
               ELSE 0
             END AS "textScore"
      FROM scored s
    )
    SELECT n."id",
           n."vectorScore",
           n."textScore",
           (0.55 * n."vectorScore" + 0.45 * n."textScore") AS "score"
    FROM normalized n
    WHERE (0.55 * n."vectorScore" + 0.45 * n."textScore") >= ${Number(threshold) || 0}
    ORDER BY "score" DESC
    LIMIT ${Math.max(1, Math.min(100, Number(limit) || 12))}
  `;

  if (rows.length === 0) return { assets: [], hits: [] };

  const ids = rows.map((row) => row.id);
  const fetched = await prisma.asset.findMany({
    where: { id: { in: ids } },
    include: { versions: true, decisionHistory: true },
  });
  const byId = new Map(fetched.map((row) => [row.id, row]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined);
  const assets = ordered.map(toDomainAsset);

  const hits: AssetSearchHit[] = rows.map((row) => {
    const matchedBy: AssetSearchHit["matchedBy"] = [
      ...(row.vectorScore > 0 ? (["vector"] as const) : []),
      ...(row.textScore > 0 ? (["fulltext"] as const) : []),
    ];
    return {
      assetId: row.id,
      score: Math.min(1, Math.max(0, row.score)),
      vectorScore: row.vectorScore,
      textScore: row.textScore,
      matchedBy,
    };
  });

  return { assets, hits };
}

export interface ReindexResult {
  count: number;
  failed: number;
  durationMs: number;
}

const REINDEX_BATCH_SIZE = 10;

/**
 * Stage 4.2 — Rebuilds the hybrid search index for the whole inventory.
 *
 * Iterates every asset in batches of `REINDEX_BATCH_SIZE`, re-deriving each
 * asset's `searchText` and a fresh pgvector embedding via `indexAsset`
 * (OpenAI → Gemini → deterministic fallback). Batches run concurrently so a
 * full re-index is dominated by embedding generation latency, not the round
 * trips. Individual failures are swallowed and counted so one bad row cannot
 * abort a full re-index. Returns the processed count, failures, and wall-clock
 * timing in milliseconds.
 */
export async function reindexAllAssets(): Promise<ReindexResult> {
  const [assets, collections] = await Promise.all([getAssets(), getCollections()]);
  const collectionNames = new Map(collections.map((c) => [c.id, c.name]));

  const started = performance.now();
  let failed = 0;

  for (let i = 0; i < assets.length; i += REINDEX_BATCH_SIZE) {
    const batch = assets.slice(i, i + REINDEX_BATCH_SIZE);
    const outcomes = await Promise.all(
      batch.map((asset) =>
        indexAsset(asset, collectionNames.get(asset.collectionId))
          .then(() => true)
          .catch((error) => {
            console.error(`reindex: failed for asset ${asset.id}`, error);
            return false;
          }),
      ),
    );
    failed += outcomes.filter((ok) => !ok).length;
  }

  return { count: assets.length, failed, durationMs: Math.round(performance.now() - started) };
}
