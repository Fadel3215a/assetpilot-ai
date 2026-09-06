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
  AssetStatus,
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
export async function reindexAllAssets(
  onProgress?: (processed: number, total: number) => void,
): Promise<ReindexResult> {
  const [assets, collections] = await Promise.all([getAssets(), getCollections()]);
  const collectionNames = new Map(collections.map((c) => [c.id, c.name]));

  const started = performance.now();
  let failed = 0;
  let processed = 0;

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
    processed += outcomes.length;
    failed += outcomes.filter((ok) => !ok).length;
    onProgress?.(processed, assets.length);
  }

  return { count: assets.length, failed, durationMs: Math.round(performance.now() - started) };
}

export interface VectorAnalytics {
  totalAssets: number;
  indexedAssets: number;
  coverageRatio: number;
  embeddingDimensions: number;
  vectorExtensionAvailable: boolean;
  hnswIndexEnabled: boolean;
  consistency: {
    complete: number;
    embeddingOnly: number;
    searchTextOnly: number;
    missing: number;
  };
}

/**
 * Stage 4.3 — Inventory-level vector health snapshot.
 *
 * Aggregates the hybrid-search index state in one pass: total vs indexed asset
 * counts (coverage ratio), the actual embedding dimensionality stored in the
 * DB (`vector_dims`), and whether the pgvector extension + the HNSW
 * `Asset_embedding_hnsw_idx` index the baseline migration created are present.
 * `consistency` breaks passengers into the four `searchText`/`embedding`
 * presence combinations so either-where-desynced rows surface.
 */
export async function getVectorAnalytics(): Promise<VectorAnalytics> {
  const [extension, index, dims, counts] = await Promise.all([
    prisma.$queryRaw<Array<{ hasExtension: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) AS "hasExtension"
    `,
    prisma.$queryRaw<Array<{ hasIndex: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'Asset' AND indexname = 'Asset_embedding_hnsw_idx'
      ) AS "hasIndex"
    `,
    prisma.$queryRaw<Array<{ dims: number | null }>>`
      SELECT COALESCE(max(vector_dims("embedding")), 0)::int AS "dims"
      FROM "Asset"
    `,
    prisma.$queryRaw<Array<{ [k: string]: bigint }>>`
      SELECT
        count(*) AS "total",
        count(*) FILTER (WHERE "embedding" IS NOT NULL AND "searchText" IS NOT NULL) AS "complete",
        count(*) FILTER (WHERE "embedding" IS NOT NULL AND "searchText" IS NULL) AS "embeddingOnly",
        count(*) FILTER (WHERE "embedding" IS NULL AND "searchText" IS NOT NULL) AS "searchTextOnly"
      FROM "Asset"
    `,
  ]);

  const row = counts[0] ?? {};
  const totalAssets = Number(row.total ?? 0);
  const complete = Number(row.complete ?? 0);
  const embeddingOnly = Number(row.embeddingOnly ?? 0);
  const searchTextOnly = Number(row.searchTextOnly ?? 0);

  return {
    totalAssets,
    indexedAssets: complete,
    coverageRatio: totalAssets > 0 ? Number((complete / totalAssets).toFixed(4)) : 0,
    embeddingDimensions: Number(dims[0]?.dims ?? 0),
    vectorExtensionAvailable: Boolean(extension[0]?.hasExtension),
    hnswIndexEnabled: Boolean(index[0]?.hasIndex),
    consistency: {
      complete,
      embeddingOnly,
      searchTextOnly,
      missing: Math.max(0, totalAssets - complete - embeddingOnly - searchTextOnly),
    },
  };
}

export interface VectorNeighbor {
  assetId: string;
  name: string;
  status: AssetStatus;
  cosineDistance: number;
  l2Distance: number;
  innerProduct: number;
}

export interface InspectVectorResult {
  ok: boolean;
  error?: string;
  assetId: string;
  embedded: boolean;
  embeddingDimensions?: number;
  neighbors: VectorNeighbor[];
}

const NEIGHBOR_LIMIT_MAX = 50;

/**
 * Stage 4.3 — Nearest-neighbor inspection for a single asset's embedding.
 *
 * Runs one raw pgvector pass that, for each indexed neighbor, reports three
 * distance metrics side by side:
 *   - cosine distance   `1 - (a <=> b)`         — 0 same, 2 opposite
 *   - L2 distance       `a <-> b`               — Euclidean distance
 *   - inner product     `(a <#> b) * -1`
 *
 * Rows are ordered by cosine distance descending (under the Stage spec formula
 * larger `1 - (a <=> b)` means closer) so the top neighbors are returned first.
 * An unembedded asset returns `embedded: false` with an empty neighbor list.
 */
export async function inspectVectorNeighbors(
  assetId: string,
  limit = 6,
): Promise<InspectVectorResult> {
  const target = await prisma.$queryRaw<Array<{ dims: number | null }>>`
    SELECT vector_dims("embedding")::int AS "dims"
    FROM "Asset"
    WHERE "id" = ${assetId}
    LIMIT 1
  `;
  const dimensions = target[0]?.dims ?? null;
  if (dimensions === null || dimensions <= 0) {
    return { ok: true, assetId, embedded: false, neighbors: [] };
  }

  const clamped = Math.max(1, Math.min(NEIGHBOR_LIMIT_MAX, Number(limit) || 6));

  const rows = await prisma.$queryRaw<
    Array<{ id: string; cosine: number; l2: number; innerProduct: number }>
  >`
    WITH target AS (
      SELECT "embedding"
      FROM "Asset"
      WHERE "id" = ${assetId}
    )
    SELECT
      n."id",
      (1 - (t."embedding" <=> n."embedding")) AS "cosine",
      (t."embedding" <-> n."embedding") AS "l2",
      ((t."embedding" <#> n."embedding") * -1) AS "innerProduct"
    FROM "Asset" n, target t
    WHERE n."id" <> ${assetId}
      AND n."embedding" IS NOT NULL
    ORDER BY "cosine" DESC
    LIMIT ${clamped}
  `;

  if (rows.length === 0) {
    return { ok: true, assetId, embedded: true, embeddingDimensions: dimensions, neighbors: [] };
  }

  const ids = rows.map((row) => row.id);
  const neighbors = await prisma.asset.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, status: true },
  });
  const byId = new Map(neighbors.map((n) => [n.id, n]));

  return {
    ok: true,
    assetId,
    embedded: true,
    embeddingDimensions: dimensions,
    neighbors: rows.map((row) => ({
      assetId: row.id,
      name: byId.get(row.id)?.name ?? "Unknown asset",
      status: byId.get(row.id)?.status ?? "DRAFT",
      cosineDistance: row.cosine,
      l2Distance: row.l2,
      innerProduct: row.innerProduct,
    })),
  };
}
