import { getVectorAnalytics, type VectorAnalytics } from "@/lib/server/queries";
import { requireRequestRole } from "@/lib/auth";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Stage 4.3 — Vector health analytics endpoint.
 *
 * GET /api/search/analytics
 *
 * Guarded to VIEWER minimum. Returns the inventory-wide hybrid-search index
 * snapshot: coverage ratio, embedding dimensions, pgvector + HNSW availability,
 * and the `searchText`/`embedding` consistency breakdown.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireRequestRole(request, "VIEWER");
  if (auth instanceof Response) return auth;

  try {
    const analytics = await getVectorAnalytics();
    return Response.json({ ok: true, ...analytics });
  } catch (error) {
    console.error("analytics: vector inspection failed", error);
    return Response.json(
      { ok: false, error: "Could not load vector analytics." },
      { status: 500 },
    );
  }
}

export type VectorAnalyticsApiResponse =
  | ({ ok: true } & VectorAnalytics)
  | { ok: false; error: string };