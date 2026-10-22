/**
 * P0.2 — Media file ownership resolution (pure path parsing).
 *
 * Files under `storage/uploads` encode their owner in the path shape:
 *   - `renditions/{assetId}/...`   per-asset derivative media
 *   - `assets/{assetId}/...`       direct-upload object keys (local backend)
 *   - `{versionId}-{fileName}`     per-version uploaded originals
 *
 * The parser turns a requested relative path into a lookup the server can
 * validate against the caller's workspace (lib/server/workspace-context.ts);
 * anything unrecognised resolves to "no owner" and is served as a 404.
 */

export type MediaOwnerRef =
  | { kind: "asset"; assetId: string }
  | { kind: "version"; fileBase: string };

/**
 * Parses a storage-relative media path (already path-traversal sanitized by the
 * route) into an ownership reference, or null when the shape is unknown.
 */
export function parseMediaOwnerRef(relativePath: string): MediaOwnerRef | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return null;

  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;

  const first = segments[0];
  if (first === "renditions" || first === "assets") {
    const assetId = segments[1];
    if (!assetId) return null;
    return { kind: "asset", assetId };
  }

  // Root-level file: `{versionId}-{sanitizedFileName}` (server-generated id).
  return { kind: "version", fileBase: first };
}
