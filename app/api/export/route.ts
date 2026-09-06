import { getAssetById, getAssets, getCollections } from "@/lib/server/queries";
import { buildExportZip } from "@/lib/export";
import { requireRequestRole } from "@/lib/auth";
import type { Asset } from "@/types";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Stage 4.2 — Automated export pipeline download endpoint.
 *
 * GET /api/export?assetIds=<id1>,<id2>  (specific assets)
 * GET /api/export?collectionId=<id>     (all assets in a collection)
 *
 * Streams back a ZIP containing each asset's current-version media plus its
 * metadata JSON sidecar.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireRequestRole(request, "VIEWER");
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const rawIds = (url.searchParams.get("assetIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const collectionId = url.searchParams.get("collectionId")?.trim() || undefined;

  let assets: Asset[];
  let label = "assets";

  try {
    if (collectionId) {
      const all = await getAssets();
      assets = all.filter((a) => a.collectionId === collectionId);
      const collections = await getCollections();
      label = collections.find((c) => c.id === collectionId)?.name ?? "collection";
      if (assets.length === 0) {
        return new Response("No assets found for this collection.", { status: 404 });
      }
    } else if (rawIds.length > 0) {
      const loaded: Asset[] = [];
      for (const id of rawIds) {
        const asset = await getAssetById(id);
        if (asset) loaded.push(asset);
      }
      assets = loaded;
      label = loaded.length === 1 ? loaded[0].name : "assets";
      if (assets.length === 0) {
        return new Response("No assets found for the requested ids.", { status: 404 });
      }
    } else {
      return new Response("Provide ?assetIds= or ?collectionId=.", { status: 400 });
    }
  } catch (error) {
    console.error("export: failed to load assets", error);
    return new Response("Export failed.", { status: 500 });
  }

  const collections = await getCollections();

  try {
    const { buffer, fileName } = await buildExportZip(assets, collections, label);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error("export: failed to build zip", error);
    return new Response("Export failed.", { status: 500 });
  }
}
