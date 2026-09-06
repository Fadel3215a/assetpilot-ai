import { reindexAllAssets } from "@/lib/server/queries";
import { requireRequestRole } from "@/lib/auth";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Stage 4.2 — Hybrid search index rebuild endpoint.
 *
 * POST /api/search/reindex
 *
 * Guarded to CURATOR minimum. Rebuilds `searchText` + pgvector embeddings for
 * every asset in batches and returns the processed count, failures, and
 * wall-clock duration in milliseconds.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireRequestRole(request, "CURATOR");
  if (auth instanceof Response) return auth;

  try {
    const result = await reindexAllAssets();
    return Response.json({
      ok: true,
      count: result.count,
      failed: result.failed,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error("reindex: rebuild failed", error);
    return Response.json(
      { ok: false, error: "Re-indexing failed. Please try again." },
      { status: 500 },
    );
  }
}

export type ReindexApiResponse =
  | { ok: true; count: number; failed: number; durationMs: number }
  | { ok: false; error: string };