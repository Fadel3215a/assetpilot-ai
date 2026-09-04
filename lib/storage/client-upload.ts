import { extractFileMetadata } from "@/lib/file-metadata";
import { registerDirectUploadAction } from "@/lib/server/actions";
import type { Asset, ExtractedFileMetadata } from "@/types";

/**
 * Stage 2.2 — Client-side direct-upload manager.
 *
 * Coordinates a storage upload from the browser:
 *
 *   1. Requests a presigned PUT URL via POST /api/storage/presigned-url.
 *   2a. Remote backends (S3/R2): streams the file via XHR PUT straight to
 *       storage, reporting byte progress as it goes.
 *   2b. Local fallback: the target is the object key, so the file bytes are
 *       bundled with the register call and persisted through the storage
 *       adapter server-side.
 *   3. Calls registerDirectUploadAction to persist the asset and enqueue the
 *      background ingestion job.
 */

export interface DirectUploadByteProgress {
  uploadedBytes: number;
  totalBytes: number;
}

export interface DirectUploadOptions {
  /** Called with byte counts while a file streams to remote storage. */
  onByteProgress?: (progress: DirectUploadByteProgress) => void;
}

export interface DirectUploadResult {
  ok: boolean;
  error?: string;
  assetId?: string;
  /** Canonical asset record once the register step has persisted it. */
  asset?: Asset;
}

interface PresignedUrlResponse {
  ok: boolean;
  uploadUrl?: string;
  key?: string;
  assetId?: string;
  error?: string;
}

async function requestPresignedUrl(
  file: File,
  collectionId?: string,
): Promise<{ uploadUrl: string; key: string; assetId: string }> {
  const response = await fetch("/api/storage/presigned-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      collectionId,
    }),
  });

  let payload: PresignedUrlResponse;
  try {
    payload = (await response.json()) as PresignedUrlResponse;
  } catch {
    throw new Error("Could not prepare the upload. Please try again.");
  }

  if (!response.ok || !payload.ok || !payload.uploadUrl || !payload.key || !payload.assetId) {
    throw new Error(payload.error ?? "Could not prepare the upload. Please try again.");
  }

  return { uploadUrl: payload.uploadUrl, key: payload.key, assetId: payload.assetId };
}

/** PUTs the file to a presigned URL, resolving once the upload completes. */
function putWithByteProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onByteProgress?: (progress: DirectUploadByteProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onByteProgress) {
        onByteProgress({ uploadedBytes: event.loaded, totalBytes: event.total });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload to storage failed (${xhr.status}). Please try again.`));
    };
    xhr.onerror = () => reject(new Error("Could not reach storage. Please try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));

    xhr.send(file);
  });
}

function buildRegisterFormData(
  file: File,
  collectionId: string,
  key: string,
  assetId: string,
  contentType: string,
  includeFile: boolean,
  extracted: ExtractedFileMetadata,
): FormData {
  const formData = new FormData();
  formData.append("assetId", assetId);
  formData.append("key", key);
  formData.append("fileName", file.name);
  formData.append("contentType", contentType);
  formData.append("size", String(file.size));
  formData.append("collectionId", collectionId);
  formData.append("extractedMetadata", JSON.stringify(extracted));
  if (includeFile) formData.append("file", file);
  return formData;
}

/**
 * Uploads a file directly to storage and registers the resulting asset.
 *
 * Resolves with the canonical asset id once the object is in place and the
 * asset record is persisted. Remote backends surface byte-level progress
 * through `options.onByteProgress`; the local fallback has no transfer step.
 */
export async function uploadDirectToStorage(
  file: File,
  collectionId = "col-archive-draft",
  options: DirectUploadOptions = {},
): Promise<DirectUploadResult> {
  try {
    const { uploadUrl, key, assetId } = await requestPresignedUrl(file, collectionId);
    const contentType = file.type || "application/octet-stream";
    const extracted = await extractFileMetadata(file);

    let registered: {
      ok: boolean;
      error?: string;
      assetId?: string;
      asset?: Asset;
    };

    if (uploadUrl.startsWith("http://") || uploadUrl.startsWith("https://")) {
      await putWithByteProgress(uploadUrl, file, contentType, options.onByteProgress);
      registered = await registerDirectUploadAction(
        buildRegisterFormData(file, collectionId, key, assetId, contentType, false, extracted),
      );
    } else {
      registered = await registerDirectUploadAction(
        buildRegisterFormData(file, collectionId, key, assetId, contentType, true, extracted),
      );
    }

    if (!registered.ok) {
      return { ok: false, error: registered.error ?? "Could not process uploaded file." };
    }

    return {
      ok: true,
      assetId: registered.assetId ?? assetId,
      asset: registered.asset,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not process uploaded file.",
    };
  }
}