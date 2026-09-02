import { prisma } from "@/lib/db";
import { createGeminiClient } from "@/lib/ai/gemini-provider";
import { getCurrentVersion } from "@/lib/utils";
import type { Asset, AssetSearchHit, Collection } from "@/types";

/**
 * Stage 4.1 — Hybrid vector + full-text search.
 *
 * Two retrieval signals are combined per asset:
 *   1. Vector similarity using a pgvector `vector(1536)` embedding and the
 *      cosine-distance operator `<=>`. Embeddings come from the Gemini
 *      `gemini-embedding-001` model when `GEMINI_API_KEY` is present, otherwise
 *      from a deterministic local hashing embedding so search always works
 *      offline (both emit exactly 1536 dimensions).
 *   2. PostgreSQL full-text search over a denormalized `searchText` column
 *      (`to_tsvector` / `plainto_tsquery`).
 *
 * The vector column is mapped with `Unsupported("vector(1536)")` in the Prisma
 * schema, so it is never exposed through the typed client; all vector reads and
 * writes go through raw SQL here.
 */

const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_MODEL = "gemini-embedding-001";

function geminiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

/**
 * Denormalized searchable text for an asset. This is what both full-text search
 * and (together with the query text) embeddings are derived from, so keeping the
 * sources consistent matters: FTS matches tokens, the embedding captures meaning.
 */
export function buildSearchText(asset: Asset, collectionName?: string): string {
  const version = getCurrentVersion(asset);
  const parts = [
    asset.name,
    version.metadata.title,
    version.metadata.description,
    version.metadata.prompt,
    version.metadata.generator,
    asset.tags.join(" "),
    collectionName,
    asset.usageNotes,
    asset.type,
    asset.status,
  ];
  return parts
    .filter((p): p is string => Boolean(p && p.trim().length > 0))
    .join("\n")
    .normalize("NFKC")
    .toLowerCase();
}

/**
 * Deterministic, dependency-free hashing embedding. Produces a fixed 1536-dim
 * unit vector so cosine similarity is meaningful, giving a "lexical bag of
 * words" fallback when no Gemini key is configured.
 */
export function fallbackEmbedding(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const positiveHash = h >>> 0;
    const idx = positiveHash % dimensions;
    const sign = (positiveHash >> 16) & 1 ? 1 : -1;
    vec[idx] += sign;
  }

  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
  return vec;
}

/**
 * Generates a 1536-dim embedding for arbitrary text. Uses the Gemini embedding
 * model when a `GEMINI_API_KEY` is present and reachable; falls back to the
 * deterministic local embedding on any error.
 *
 * Note: `gemini-embedding-001` natively emits 3072 dimensions, but pgvector's
 * HNSW/IVFFlat indexes cap at 2000 dimensions, so retrieval at *full* width
 * can't be indexed. We down-project to the first 1536 components — a simple,
 * deterministic reduction of the most significant dimensions that keeps cosine
 * similarity meaningful while fitting an HNSW index.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const key = geminiKey();
  if (key) {
    try {
      const client = createGeminiClient(key);
      const response = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: [{ role: "user", parts: [{ text }] }],
      });
      const values = response.embeddings?.[0]?.values;
      if (values && values.length >= EMBEDDING_DIMENSIONS) {
        return values.slice(0, EMBEDDING_DIMENSIONS);
      }
      console.warn(
        `[search] Gemini embedding returned ${values?.length ?? 0} dims (expected >= ${EMBEDDING_DIMENSIONS}); using fallback.`,
      );
    } catch (error) {
      console.warn(`[search] Gemini embedding failed; using fallback.`, error);
    }
  }
  return fallbackEmbedding(text);
}

/**
 * Computes and persists the search index (embedding + searchText) for a single
 * asset. `searchText` is written through the typed client; the vector embedding
 * through raw SQL because the `Unsupported("vector(1536)")` column is not exposed
 * by the client types. Safe to call on newly created or updated assets.
 */
export async function indexAsset(asset: Asset, collectionName?: string): Promise<void> {
  const searchText = buildSearchText(asset, collectionName);
  const embedding = await generateEmbedding(searchText);

  await prisma.asset.update({
    where: { id: asset.id },
    data: { searchText },
  });

  const vectorLiteral = `[${embedding.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE "Asset" SET "embedding" = ${vectorLiteral}::vector
    WHERE "id" = ${asset.id}
  `;
}

/**
 * Runs the hybrid query. Retrieves up to `limit` assets ranked by a fused score
 * (Postgres FTS promotes exact-token hits, cosine similarity promotes semantic
 * ones). Unindexed rows (missing `searchText`/embeddings) are naturally skipped.
 */
export async function searchAssets(
  query: string,
  limit = 12,
): Promise<AssetSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const embedding = await generateEmbedding(trimmed);
  const vectorLiteral = `[${embedding.join(",")}]`;

  // Vector candidates: nearest neighbors by cosine distance.
  const vectorRows = await prisma.$queryRaw<
    { id: string }[]
  >`
    SELECT "id"
    FROM "Asset"
    WHERE "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vectorLiteral}::vector
    LIMIT ${limit * 2}
  `;

  // Full-text candidates: rank by ts_rank over the tsvector.
  const ftsRows = await prisma.$queryRaw<
    { id: string; rank: number }[]
  >`
    SELECT "id",
           ts_rank(to_tsvector('english', coalesce("searchText", '')), plainto_tsquery('english', ${trimmed})) AS rank
    FROM "Asset"
    WHERE "searchText" IS NOT NULL
      AND to_tsvector('english', "searchText") @@ plainto_tsquery('english', ${trimmed})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  if (vectorRows.length === 0 && ftsRows.length === 0) return [];

  const maxFtsRank = ftsRows.reduce((m, r) => Math.max(m, r.rank), 0) || 1;

  const vectorByAsset = new Map<string, number>();
  let vecRank = 0;
  for (const row of vectorRows) {
    // Positional similarity: nearest neighbor gets ~1.0, falling off linearly.
    vectorByAsset.set(row.id, 1 - vecRank / Math.max(vectorRows.length, 1));
    vecRank++;
  }

  const ftsByAsset = new Map<string, number>();
  for (const row of ftsRows) {
    ftsByAsset.set(row.id, maxFtsRank > 0 ? row.rank / maxFtsRank : 0);
  }

  const candidateIds = new Set([...vectorByAsset.keys(), ...ftsByAsset.keys()]);
  const hits: AssetSearchHit[] = [];

  for (const id of candidateIds) {
    const vectorScore = vectorByAsset.get(id) ?? 0;
    const textScore = ftsByAsset.get(id) ?? 0;
    const matchedBy: ("vector" | "fulltext")[] = [
      ...(vectorScore > 0 ? (["vector"] as const) : []),
      ...(textScore > 0 ? (["fulltext"] as const) : []),
    ];
    const score = 0.5 * vectorScore + 0.5 * textScore;
    hits.push({
      assetId: id,
      score: Math.min(1, Math.max(0, score)),
      vectorScore,
      textScore,
      matchedBy,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Indexes a full inventory of assets (used by the demo seed/reset path). */
export async function indexCollection(assets: Asset[], collections: Collection[]): Promise<void> {
  for (const asset of assets) {
    const collection = collections.find((c) => c.id === asset.collectionId);
    await indexAsset(asset, collection?.name);
  }
}
