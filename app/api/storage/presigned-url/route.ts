import { NextRequest } from "next/server";
import { requireRequestRole } from "@/lib/auth";
import { getStorageAdapter } from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stage 2.2 — Presigned direct-upload entry point.
 *
 * Issues a time-limited upload URL for an object key derived from a freshly
 * generated asset id (`assets/{assetId}/{fileName}`). The browser then uploads
 * the file bytes directly to S3/R2 out-of-band; the local backend returns the
 * object key as the upload target, which the client resolves through the
 * register flow instead of a direct PUT.
 *
 * Returns { uploadUrl, key, assetId } guarded to CURATOR+.
 */

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^A-Za-z0-9._-]/g, "_");
}

function generateAssetId(): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `asset-upload-${Date.now()}-${suffix}`;
}

function badRequest(message: string): Response {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await requireRequestRole(request, "CURATOR");
  if (guard instanceof Response) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const record = (body ?? {}) as { fileName?: unknown; contentType?: unknown; collectionId?: unknown };

  const fileName = typeof record.fileName === "string" ? record.fileName.trim() : "";
  if (!fileName) return badRequest("fileName is required.");

  const contentType =
    typeof record.contentType === "string" && record.contentType.trim()
      ? record.contentType.trim()
      : "application/octet-stream";
  const collectionId =
    typeof record.collectionId === "string" && record.collectionId.trim()
      ? record.collectionId.trim()
      : undefined;

  const assetId = generateAssetId();
  const key = `assets/${assetId}/${sanitizeFileName(fileName)}`;

  try {
    const uploadUrl = await getStorageAdapter().getPresignedUploadUrl(key, contentType);
    return Response.json({ ok: true, uploadUrl, key, assetId, contentType, collectionId });
  } catch (error) {
    console.error("storage/presigned-url: failed to issue upload URL", error);
    return Response.json(
      { ok: false, error: "Could not issue an upload URL. Please try again." },
      { status: 500 },
    );
  }
}