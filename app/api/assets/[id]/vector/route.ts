import { inspectVectorNeighbors, type InspectVectorResult } from "@/lib/server/queries";
import { requireRequestRole } from "@/lib/auth";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Stage 4.3 — Per-asset vector inspection endpoint.
 *
 * GET /api/assets/[id]/vector?limit=6
 *
 * Guarded to VIEWER minimum. Returns whether the asset has an embedding (plus
 * its actual dimensionality) and its top nearest neighbors with a three-metric
 * distance breakdown (cosine distance, L2 distance, inner product).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireRequestRole(request, "VIEWER");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (!id) {
    return Response.json({ ok: false, error: "Missing asset id." }, { status: 400 });
  }

  const parsedLimit = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 6;

  try {
    const result = await inspectVectorNeighbors(id, limit);
    return Response.json(result);
  } catch (error) {
    console.error(`assets/${id}/vector: inspection failed`, error);
    return Response.json(
      { ok: false, error: "Could not inspect this asset's vector." },
      { status: 500 },
    );
  }
}

export type AssetVectorApiResponse = InspectVectorResult | { ok: false; error: string };