import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

type MediaRouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: MediaRouteContext): Promise<Response> {
  const { path: segments } = await context.params;

  if (!segments || segments.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const safeSegments = segments.map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, "_"));
  const target = path.resolve(STORAGE_ROOT, ...safeSegments);

  if (!target.startsWith(STORAGE_ROOT + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  let fileInfo;
  try {
    fileInfo = await stat(target);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (!fileInfo.isFile()) {
    return new Response("Not found", { status: 404 });
  }

  const contentType =
    MIME_BY_EXTENSION[path.extname(target).toLowerCase()] ?? "application/octet-stream";
  const stream = Readable.toWeb(createReadStream(target)) as unknown as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileInfo.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
