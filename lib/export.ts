import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import type { Asset, Collection } from "@/types";
import { getCurrentVersion } from "@/lib/utils";

/**
 * Stage 4.2 — Automated export pipeline.
 *
 * Packages approved assets into a ZIP archive containing each asset's current
 * version media files plus a JSON metadata sidecar (so the exported bundle is
 * self-describing and re-importable). Media URIs under /media/ are resolved to
 * their on-disk files under storage/uploads/ using the same path-sanitization
 * rules as the media route; any file that cannot be located on disk is skipped
 * (the sidecar still records its intended path).
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

/** Converts a /media/... URI to an absolute on-disk path, or null if unsafe. */
export function resolveMediaFile(mediaUrl: string | undefined | null): string | null {
  if (!mediaUrl || !mediaUrl.startsWith("/media/")) return null;
  const segments = mediaUrl.replace(/^\/media\//, "").split("/").filter(Boolean);
  const safe = segments.map((s) => s.replace(/[^A-Za-z0-9._-]/g, "_"));
  const target = path.resolve(STORAGE_ROOT, ...safe);
  if (!target.startsWith(STORAGE_ROOT + path.sep)) return null;
  return target;
}

/** Returns the current-version media files that actually exist on disk. */
async function collectVersionFiles(asset: Asset): Promise<string[]> {
  const version = getCurrentVersion(asset);
  const candidates = [version.previewPath, version.mediaUrl, version.thumbnailPath].filter(
    Boolean,
  ) as string[];

  const files: string[] = [];
  for (const uri of candidates) {
    const target = resolveMediaFile(uri);
    if (!target) continue;
    try {
      await open(target, "r").then((h) => h.close());
      if (!files.includes(target)) files.push(target);
    } catch {
      // File not on disk — skip.
    }
  }
  return files;
}

function safeZipName(value: string): string {
  return value.replace(/[^A-Za-z0-9._ -]/g, "_").trim() || "asset";
}

function extensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : "";
}

/** Builds the JSON metadata sidecar for an asset's current version. */
export function buildMetadataSidecar(asset: Asset, collection?: Collection): unknown {
  const version = getCurrentVersion(asset);
  return {
    assetId: asset.id,
    name: asset.name,
    type: asset.type,
    status: asset.status,
    collection: collection ? { id: collection.id, name: collection.name } : null,
    tags: asset.tags,
    currentVersionId: version.id,
    versionNumber: version.versionNumber,
    label: version.label,
    media: {
      mediaUrl: version.mediaUrl ?? null,
      previewPath: version.previewPath,
      thumbnailPath: version.thumbnailPath,
    },
    metadata: {
      title: version.metadata.title,
      description: version.metadata.description,
      prompt: version.metadata.prompt ?? null,
      generator: version.metadata.generator ?? null,
      dimensions: version.metadata.dimensions ?? null,
      duration: version.metadata.duration ?? null,
      format: version.metadata.format,
      fileSize: version.metadata.fileSize,
      fileName: version.metadata.fileName ?? null,
      mimeType: version.metadata.mimeType ?? null,
      updatedAt: version.metadata.updatedAt,
    },
    quality: {
      overall: version.qualityScore.overall,
      curatorScore: version.curatorScore ?? null,
      reviewDecision: version.reviewDecision,
    },
    productionReadiness: asset.productionReadiness,
    usageNotes: asset.usageNotes ?? null,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Builds a ZIP archive for the given assets. Each asset contributes a
 * `<safe-name>-<id>/` folder containing its current-version media files (when
 * present on disk) and a `<name>.json` metadata sidecar. Returns the raw ZIP
 * bytes and a suggested download filename.
 */
export async function buildExportZip(
  assets: Asset[],
  collections: Collection[],
  label = "assets",
): Promise<{ buffer: Buffer; fileName: string }> {
  const zip = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  zip.on("data", (chunk: string | Buffer) => chunks.push(Buffer.from(chunk)));

  const completion = new Promise<void>((resolve, reject) => {
    zip.on("end", () => resolve());
    zip.on("error", reject);
  });

  for (const asset of assets) {
    const collection = collections.find((c) => c.id === asset.collectionId);
    const dirName = `${safeZipName(asset.name)}-${asset.id}`;
    const baseName = safeZipName(asset.name);
    const version = getCurrentVersion(asset);

    // Metadata sidecar.
    zip.append(JSON.stringify(buildMetadataSidecar(asset, collection), null, 2), {
      name: `${dirName}/${baseName}.json`,
    });

    // Version media files present on disk.
    const mediaFiles = await collectVersionFiles(asset);
    const primaryMediaTarget = resolveMediaFile(version.mediaUrl) ?? null;
    for (const filePath of mediaFiles) {
      const ext = extensionOf(filePath) || ".bin";
      const isPrimary = primaryMediaTarget === filePath;
      const entryName = isPrimary
        ? `${dirName}/${baseName}${ext}`
        : `${dirName}/${path.basename(filePath)}`;
      const stream = Readable.toWeb(
        createReadStream(filePath),
      ) as unknown as import("node:stream").Readable;
      zip.append(stream, { name: entryName });
    }

    // If no media file was on disk, still note it so exports are complete.
    if (mediaFiles.length === 0) {
      zip.append(
        JSON.stringify(
          {
            assetId: asset.id,
            note: "No media file found on disk for this asset's current version.",
          },
          null,
          2,
        ),
        { name: `${dirName}/MEDIA-MISSING.json` },
      );
    }
  }

  zip.finalize();
  await completion;

  const buffer = Buffer.concat(chunks);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return { buffer, fileName: `${label}-${stamp}.zip` };
}
