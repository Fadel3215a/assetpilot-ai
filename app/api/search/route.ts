import { hybridSearchAssets } from "@/lib/server/queries";
import { requireRequestRole } from "@/lib/auth";
import type { Asset, AssetSearchHit } from "@/types";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

interface SearchRequestBody {
  query?: unknown;
  collectionId?: unknown;
  limit?: unknown;
  threshold?: unknown;
  vectorWeight?: unknown;
}

/**
 * Stage 4.1 — Hybrid search API endpoint.
 *
 * POST /api/search
 * Body: { query, collectionId?, limit?, threshold? }
 *
 * Accepts a semantic query string, generates its embedding (OpenAI → Gemini →
 * deterministic local fallback), and returns the top assets fused by vector
 * cosine similarity + PostgreSQL full-text rank. Guarded to VIEWER minimum.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireRequestRole(request, "VIEWER");
  if (auth instanceof Response) return auth;

  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return Response.json(
      { ok: false, error: "Provide a JSON body with a `query` string." },
      { status: 400 },
    );
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return Response.json(
      { ok: false, error: "Provide a non-empty `query` string." },
      { status: 400 },
    );
  }

  const collectionId =
    typeof body.collectionId === "string" && body.collectionId.trim()
      ? body.collectionId.trim()
      : undefined;

  const parsedLimit = Number(body.limit);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(100, Math.trunc(parsedLimit)))
    : 12;

  const parsedThreshold = Number(body.threshold);
  const threshold = Number.isFinite(parsedThreshold) ? parsedThreshold : 0;

  const parsedWeight = Number(body.vectorWeight);
  const vectorWeight = Number.isFinite(parsedWeight) ? Math.min(1, Math.max(0, parsedWeight)) : undefined;

  try {
    const { assets, hits } = await hybridSearchAssets({
      query,
      collectionId,
      limit,
      threshold,
      vectorWeight,
    });
    return Response.json({ ok: true, count: assets.length, assets, hits, vectorWeight });
  } catch (error) {
    console.error("search: hybrid search failed", error);
    return Response.json(
      { ok: false, error: "Search failed. Please try again." },
      { status: 500 },
    );
  }
}

export type SearchApiResponse =
  | { ok: true; count: number; assets: Asset[]; hits: AssetSearchHit[] }
  | { ok: false; error: string };