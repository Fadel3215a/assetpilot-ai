import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getStorageAdapter } from "@/lib/storage/s3";
import { getCurrentVersion } from "@/lib/utils";
import type { Asset } from "@/types";
import type { ObjectStream } from "@/lib/storage/types";

/**
 * Stage 2.3 — Zero-RAM streaming ZIP export engine.
 *
 * Streams the current-version media files of a set of assets into a ZIP
 * archive without ever buffering a full file in memory. Source files are pulled
 * from the configured storage adapter (`getObjectStream`) and appended to the
 * archiver as Node streams; the archiver's output is forwarded through a
 * PassThrough and surfaced as a Web ReadableStream that the HTTP response pipes
 * straight to the browser.
 *
 * Archive entries use clean internal paths: `<collectionId>/<assetName>.<ext>`.
 */

/** Converts a /media/... URI into its storage key (the URI minus the prefix). */
function storageKeyOfMedia(uri: string | undefined | null): string | null {
  if (!uri || !uri.startsWith("/media/")) return null;
  const key = uri.slice("/media/".length).split("/").filter(Boolean).join("/");
  return key || null;
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._ -]/g, "_").trim();
  return cleaned || "asset";
}

function extensionOf(key: string): string {
  const base = key.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

/** Adapts a storage object stream (web or Node) into a Node Readable for archiver. */
function toNodeReadable(stream: ObjectStream): Readable {
  return stream instanceof Readable
    ? stream
    : Readable.fromWeb(stream as unknown as import("node:stream/web").ReadableStream<Uint8Array>);
}

/**
 * Builds a ZIP stream containing each asset's current-version media file.
 *
 * Resolves the primary media object via the storage adapter per asset and
 * appends it to the archive. Assets whose object cannot be located are recorded
 * as a small placeholder note so exports stay complete.
 */
export async function createZipArchiveStream(assets: Asset[]): Promise<ReadableStream<Uint8Array>> {
  const adapter = getStorageAdapter();
  const archive = new ZipArchive({ zlib: { level: 5 } });
  const passthrough = new PassThrough();

  // Route archiver output (and errors) through the PassThrough so the web
  // stream consumers see a terminal error if any source stream fails.
  archive.pipe(passthrough);
  const onError = (error: Error) => {
    if (!passthrough.destroyed) passthrough.destroy(error);
  };
  archive.on("error", onError);

  for (const asset of assets) {
    const version = getCurrentVersion(asset);
    const folder = safeSegment(asset.collectionId);
    const baseName = safeSegment(asset.name);
    const candidates = [version.mediaUrl, version.previewPath, version.thumbnailPath];

    let appended = false;
    for (const uri of candidates) {
      const key = storageKeyOfMedia(uri);
      if (!key) continue;
      try {
        const source = await adapter.getObjectStream(key);
        if (!source) continue;
        const extension = extensionOf(key) || ".bin";
        archive.append(toNodeReadable(source), { name: `${folder}/${baseName}${extension}` });
        appended = true;
        break;
      } catch (error) {
        console.error(`export-stream: failed to stream object ${key}`, error);
      }
    }

    if (!appended) {
      archive.append(`No media object found in storage for "${asset.name}".\n`, {
        name: `${folder}/${baseName}.MISSING.txt`,
      });
    }
  }

  // Finalize after every entry is appended; the consumer drives completion by
  // reading the returned web stream (backpressure through the PassThrough).
  archive.finalize().catch(onError);

  return Readable.toWeb(passthrough) as ReadableStream<Uint8Array>;
}