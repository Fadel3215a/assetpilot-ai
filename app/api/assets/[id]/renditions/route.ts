import { open } from "node:fs/promises";
import { getAssetById } from "@/lib/server/queries";
import { resolveMediaFile } from "@/lib/export";
import { enqueueBackgroundJob } from "@/lib/queue/jobs";
import { requireRequestRole } from "@/lib/auth";
import { getCurrentVersion } from "@/lib/utils";
import type { AssetVersion, ConvertRenditionJobData } from "@/types";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Stage 5.2 — Per-asset rendition management.
 *
 * GET /api/assets/[id]/renditions — guarded to VIEWER minimum. Returns the
 * asset's active versions and, for each, its current thumbnail/preview paths
 * (as `/media/` URIs) with metadata and an on-disk existence check.
 *
 * POST /api/assets/[id]/renditions — guarded to CURATOR minimum. Enqueues a
 * CONVERT_RENDITION background job targeting the asset's current version, or an
 * explicit versionId from the body. Returns the job id/state so the UI can
 * stream progress.
 */

interface VersionRendition {
  versionId: string;
  versionNumber: number;
  label: string;
  isCurrent: boolean;
  thumbnailPath: string;
  previewPath: string;
  thumbnailExists: boolean;
  previewExists: boolean;
}

async function renditionExistence(pathUri: string): Promise<boolean> {
  const disk = resolveMediaFile(pathUri);
  if (!disk) return false;
  try {
    await open(disk, "r").then((h) => h.close());
    return true;
  } catch {
    return false;
  }
}

async function mapVersion(version: AssetVersion): Promise<VersionRendition> {
  const [thumbnailExists, previewExists] = await Promise.all([
    renditionExistence(version.thumbnailPath),
    renditionExistence(version.previewPath),
  ]);
  return {
    versionId: version.id,
    versionNumber: version.versionNumber,
    label: version.label,
    isCurrent: version.isCurrent,
    thumbnailPath: version.thumbnailPath,
    previewPath: version.previewPath,
    thumbnailExists,
    previewExists,
  };
}

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

  const asset = await getAssetById(id);
  if (!asset) {
    return Response.json({ ok: false, error: "Asset not found." }, { status: 404 });
  }

  const current = getCurrentVersion(asset);
  const versions = await Promise.all(
    asset.versions
      .slice()
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map((v) => mapVersion(v)),
  );

  return Response.json({
    ok: true,
    assetId: asset.id,
    currentVersionId: current.id,
    versions,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireRequestRole(request, "CURATOR");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (!id) {
    return Response.json({ ok: false, error: "Missing asset id." }, { status: 400 });
  }

  const asset = await getAssetById(id);
  if (!asset) {
    return Response.json({ ok: false, error: "Asset not found." }, { status: 404 });
  }

  let versionId: string | undefined;
  try {
    const raw = await request.json();
    versionId = (raw as { versionId?: string })?.versionId?.trim() || undefined;
  } catch {
    versionId = undefined;
  }

  if (versionId && !asset.versions.some((v) => v.id === versionId)) {
    return Response.json(
      { ok: false, error: "Requested version does not belong to this asset." },
      { status: 400 },
    );
  }

  const data: ConvertRenditionJobData = {
    assetId: id,
    ...(versionId ? { versionId } : {}),
  };

  const jobId = await enqueueBackgroundJob("CONVERT_RENDITION", data);
  return Response.json(
    { ok: true, jobId, assetId: id, versionId: versionId ?? getCurrentVersion(asset).id },
    { status: 202 },
  );
}

export type RenditionsApiResponse =
  | {
      ok: true;
      assetId: string;
      currentVersionId: string;
      versions: VersionRendition[];
    }
  | { ok: false; error: string };