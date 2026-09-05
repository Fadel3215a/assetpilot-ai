import { getAssetById, getAssets } from "@/lib/server/queries";
import { requireRequestRole } from "@/lib/auth";
import { createZipArchiveStream } from "@/lib/export-stream";
import type { Asset } from "@/types";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Stage 2.3 — Zero-RAM streaming ZIP export endpoint.
 *
 * POST /api/export/stream
 *   body: { assetIds?: string[]; collectionId?: string }
 *
 * Streams a ZIP of the requested assets' current-version media back to the
 * browser with no server-side file buffering. Guarded to VIEWER and above.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = requireRequestRole(request, "VIEWER");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const record = (body ?? {}) as { assetIds?: unknown; collectionId?: unknown };

  const assetIds = Array.isArray(record.assetIds)
    ? ([...new Set(
        record.assetIds.filter(
          (id): id is string => typeof id === "string" && id.trim() !== "",
        ),
      )] as string[])
    : [];
  const collectionId =
    typeof record.collectionId === "string" && record.collectionId.trim()
      ? record.collectionId.trim()
      : undefined;

  if (assetIds.length === 0 && !collectionId) {
    return Response.json({ error: "Provide assetIds[] or collectionId." }, { status: 400 });
  }

  let assets: Asset[];
  try {
    if (collectionId) {
      const all = await getAssets();
      assets = all.filter((a) => a.collectionId === collectionId);
    } else {
      const loaded: Asset[] = [];
      for (const id of assetIds) {
        const asset = await getAssetById(id);
        if (asset) loaded.push(asset);
      }
      assets = loaded;
    }
  } catch (error) {
    console.error("export/stream: failed to load assets", error);
    return Response.json({ error: "Export failed." }, { status: 500 });
  }

  if (assets.length === 0) {
    return Response.json(
      {
        error: collectionId
          ? "No assets found in this collection."
          : "No assets found for the requested ids.",
      },
      { status: 404 },
    );
  }

  try {
    const stream = await createZipArchiveStream(assets);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="assetpilot-export.zip"',
      },
    });
  } catch (error) {
    console.error("export/stream: failed to start zip stream", error);
    return Response.json({ error: "Export failed." }, { status: 500 });
  }
}