import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { parseMp4, parseWebm } from "@/lib/media-processing";
import type { ExtractedExifData, ExtractedFileMetadata } from "@/types";

/**
 * Stage 3.2 — Rendition & web preview derivation.
 *
 * Derives the display variants every asset needs from the raw uploaded bytes:
 * a 300px thumbnail and a 1080px "web preview", both encoded as WebP, written
 * to `storage/uploads/renditions/{assetId}/` and exposed as `/media/` URIs.
 *
 * The same module enriches `ExtractedFileMetadata` with server-authoritative
 * dimensions, aspect ratio, colorspace/ICC profile, and EXIF camera tags so
 * the DB row captures more than the client-side probe.
 */

export const THUMB_MAX_DIMENSION = 300;
export const PREVIEW_MAX_DIMENSION = 1080;

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const RENDITIONS_ROOT = path.join(STORAGE_ROOT, "renditions");

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tif",
  ".tiff",
  ".avif",
]);

export interface RenditionPaths {
  /** /media/renditions/{assetId}/thumbnail.webp */
  thumbnailPath: string;
  /** /media/renditions/{assetId}/preview.webp */
  previewPath: string;
  thumbnailFile: string;
  previewFile: string;
  width: number;
  height: number;
}

export function fileExtensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? `.${base.slice(dot + 1).toLowerCase()}` : "";
}

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function shouldDeriveRenditions(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Renders the 300px thumbnail and 1080px web preview for an image buffer.
 * Images are auto-rotated from EXIF orientation. Returns the two on-disk
 * files plus their `/media/` URIs, or `null` when the buffer is not a
 * derivable image or decoding fails (caller keeps the original paths).
 */
export async function deriveRenditions(
  buffer: Buffer,
  assetId: string,
  ext: string,
): Promise<RenditionPaths | null> {
  if (!shouldDeriveRenditions(ext)) return null;

  const safeId = sanitizePathSegment(assetId);
  const dir = path.join(RENDITIONS_ROOT, safeId);
  const thumbnailFile = path.join(dir, "thumbnail.webp");
  const previewFile = path.join(dir, "preview.webp");

  try {
    const base = sharp(buffer, { failOn: "error" }).rotate();
    await mkdir(dir, { recursive: true });

    const preview = (
      await Promise.all([
        base
          .clone()
          .resize(PREVIEW_MAX_DIMENSION, PREVIEW_MAX_DIMENSION, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toFile(previewFile),
        base
          .clone()
          .resize(THUMB_MAX_DIMENSION, THUMB_MAX_DIMENSION, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 72 })
          .toFile(thumbnailFile),
      ])
    )[0];

    return {
      thumbnailPath: `/media/renditions/${safeId}/thumbnail.webp`,
      previewPath: `/media/renditions/${safeId}/preview.webp`,
      thumbnailFile,
      previewFile,
      width: preview.width,
      height: preview.height,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadata enrichment
// ---------------------------------------------------------------------------

const BIT_DEPTH_BY_SHARP_DEPTH: Record<string, number> = {
  uchar: 8,
  char: 8,
  ushort: 16,
  short: 16,
  uint: 32,
  int: 32,
  float: 32,
  double: 64,
};

function rounded(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Enriches client-extracted metadata with server-authoritative values:
 * exact dimensions, aspect ratio, colorspace, ICC profile name, alpha/bit
 * depth, EXIF orientation and camera tags (for images), plus container-based
 * duration/dimensions for MP4/WebM. Falls back to the input unchanged when
 * the buffer cannot be decoded.
 */
export async function enrichExtractedFileMetadata(
  extracted: ExtractedFileMetadata,
  buffer: Buffer,
  ext: string,
): Promise<ExtractedFileMetadata> {
  try {
    if (shouldDeriveRenditions(ext)) {
      return await enrichImageMetadata(extracted, buffer, ext);
    }
    if (ext === ".mp4" || ext === ".webm") {
      return await enrichVideoMetadata(extracted, buffer, ext);
    }
  } catch {
    // Decode failures leave the (already valid) client metadata intact.
  }
  return extracted;
}

async function enrichImageMetadata(
  extracted: ExtractedFileMetadata,
  buffer: Buffer,
  ext: string,
): Promise<ExtractedFileMetadata> {
  const meta = await sharp(buffer, { failOn: "error" }).metadata();
  if (!meta || !meta.width || !meta.height) return extracted;

  const rawOrientation = meta.orientation ?? 0;
  const rotated = rawOrientation >= 5 && rawOrientation <= 8;
  const rawWidth = meta.width;
  const rawHeight = meta.height;
  const width = rotated ? rawHeight : rawWidth;
  const height = rotated ? rawWidth : rawHeight;
  const exifTags = extractExifData(buffer, ext);
  const exif: ExtractedExifData | undefined =
    exifTags && Object.values(exifTags).some((v) => v !== undefined)
      ? exifTags
      : undefined;

  return {
    ...extracted,
    dimensions: { width, height },
    aspectRatio: rounded(width / height),
    colorSpace: meta.space || undefined,
    iccProfile: extractIccProfileName(meta.icc),
    hasAlpha: meta.hasAlpha ?? undefined,
    bitDepth: meta.depth ? BIT_DEPTH_BY_SHARP_DEPTH[meta.depth] : undefined,
    orientation: rawOrientation || undefined,
    exif,
  };
}

async function enrichVideoMetadata(
  extracted: ExtractedFileMetadata,
  buffer: Buffer,
  ext: string,
): Promise<ExtractedFileMetadata> {
  const video = ext === ".mp4" ? parseMp4(buffer) : parseWebm(buffer);
  if (!video || !video.width || !video.height) return extracted;
  const { width, height } = video;
  return {
    ...extracted,
    dimensions: { width, height },
    aspectRatio: rounded(width / height),
    duration: video.durationSeconds > 0 ? rounded(video.durationSeconds, 1) : undefined,
  };
}

// ---------------------------------------------------------------------------
// EXIF extraction (JPEG APP1 / PNG eXIf / WebP EXIF) + TIFF tag reader
// ---------------------------------------------------------------------------

/** Tries to pull the raw TIFF-formatted EXIF payload out of the image bytes. */
export function extractExifData(buffer: Buffer, ext: string): ExtractedExifData | null {
  const tiff = extractExifTiff(buffer, ext);
  if (!tiff) return null;
  try {
    return parseTiffExif(tiff);
  } catch {
    return null;
  }
}

function extractExifTiff(buffer: Buffer, ext: string): Buffer | null {
  if (ext === ".jpg" || ext === ".jpeg") return extractJpegExif(buffer);
  if (ext === ".png") return extractPngExif(buffer);
  if (ext === ".webp") return extractWebpExif(buffer);
  return null;
}

function extractJpegExif(buf: Buffer): Buffer | null {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8) || marker === 0xda) return null;
    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2) return null;
    if (marker === 0xe1) {
      const payload = buf.subarray(i + 4, i + 2 + segLen);
      if (payload.length >= 6 && payload.toString("latin1", 0, 6) === "Exif\u0000\u0000") {
        return payload.subarray(6);
      }
      return null;
    }
    i += 2 + segLen;
  }
  return null;
}

function extractPngExif(buf: Buffer): Buffer | null {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) return null;
  let i = 8;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    const dataStart = i + 8;
    if (type === "eXIf") {
      if (len === 0 || dataStart + len > buf.length) return null;
      const data = buf.subarray(dataStart, dataStart + len);
      return data.length >= 6 && data.toString("latin1", 0, 6) === "Exif\u0000\u0000"
        ? data.subarray(6)
        : data;
    }
    i = dataStart + len + 4;
  }
  return null;
}

function extractWebpExif(buf: Buffer): Buffer | null {
  if (
    buf.length < 16 ||
    buf.toString("latin1", 0, 4) !== "RIFF" ||
    buf.toString("latin1", 8, 12) !== "WEBP"
  ) {
    return null;
  }
  let i = 12;
  while (i + 8 <= buf.length) {
    const fourcc = buf.toString("latin1", i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    if (fourcc === "EXIF") {
      if (size === 0 || i + 8 + size > buf.length) return null;
      const data = buf.subarray(i + 8, i + 8 + size);
      return data.length >= 6 && data.toString("latin1", 0, 6) === "Exif\u0000\u0000"
        ? data.subarray(6)
        : data;
    }
    i += 8 + size + (size & 1);
  }
  return null;
}

const EXIF_TYPE_WIDTH = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

const IFD0_TAGS: Record<number, string> = {
  0x010f: "make",
  0x0110: "model",
  0x0112: "orientation",
  0x0132: "dateTime",
};

const EXIF_SUB_TAGS: Record<number, string> = {
  0x829a: "exposureTime",
  0x829d: "fNumber",
  0x8827: "iso",
  0x9003: "dateTimeOriginal",
  0xa405: "focalLengthIn35mm",
  0xa434: "lensModel",
};

export function parseTiffExif(tiff: Buffer): ExtractedExifData {
  if (tiff.length < 8) return {};
  const little = tiff.toString("latin1", 0, 2) === "II";
  if (!little && tiff.toString("latin1", 0, 2) !== "MM") return {};
  const u16 = (o: number): number =>
    little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o);
  const u32 = (o: number): number =>
    little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o);

  if (u16(2) !== 0x002a) return {};

  const readValue = (entryOffset: number): { value?: unknown; exifIfd?: number } => {
    if (entryOffset + 12 > tiff.length) return {};
    const tag = u16(entryOffset);
    const type = u16(entryOffset + 2);
    const count = u32(entryOffset + 4);
    const width = EXIF_TYPE_WIDTH[type];
    if (!width) return {};
    const valueField = entryOffset + 8;
    const byteLength = width * count;
    const valueOffset = byteLength <= 4 ? valueField : u32(valueField);
    if (valueOffset + byteLength > tiff.length) return {};

    let value: unknown;
    if (type === 2) {
      const text = tiff
        .toString("latin1", valueOffset, valueOffset + byteLength)
        .replace(/\0+$/g, "")
        .trim();
      if (!text) return {};
      value = text;
    } else if (type === 3 && count === 1) {
      value = u16(valueOffset);
    } else if (type === 4 && count === 1) {
      value = u32(valueOffset);
    } else if (count === 1 && (type === 5 || type === 10)) {
      const den = u32(valueOffset + 4);
      value = den !== 0 ? u32(valueOffset) / den : undefined;
    } else {
      return {};
    }
    if (value === undefined) return {};
    return tag === 0x8769 ? { exifIfd: u32(valueField) } : { value };
  };

  const scanIfd = (ifdOffset: number, dst: Record<number, unknown>): number | null => {
    if (ifdOffset + 2 > tiff.length) return null;
    const entryCount = u16(ifdOffset);
    if (entryCount === 0 || ifdOffset + 2 + entryCount * 12 > tiff.length) return null;
    let exifIfd: number | null = null;
    for (let i = 0; i < entryCount; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > tiff.length) break;
      const res = readValue(entryOffset);
      if (res.exifIfd !== undefined) exifIfd = res.exifIfd;
      if (res.value !== undefined) dst[u16(entryOffset)] = res.value;
    }
    return exifIfd;
  };

  const raw: Record<number, unknown> = {};
  const exifIfd = scanIfd(u32(4), raw);
  if (exifIfd !== null) scanIfd(exifIfd, raw);

  const mapped: Record<string, unknown> = {};
  for (const [hex, key] of Object.entries({ ...IFD0_TAGS, ...EXIF_SUB_TAGS })) {
    const value = raw[Number(hex)];
    if (value !== undefined) mapped[key] = value;
  }
  return mapped as ExtractedExifData;
}

// ---------------------------------------------------------------------------
// ICC color profile name extraction (v2 "desc" ASCII / v4 UTF-16BE text)
// ---------------------------------------------------------------------------

function extractIccProfileName(icc: Buffer | undefined | null): string | null {
  if (!icc || icc.length < 132) return null;
  try {
    const tagCount = icc.readUInt32BE(128);
    for (let i = 0; i < tagCount && 132 + i * 12 + 12 <= icc.length; i++) {
      const base = 132 + i * 12;
      if (icc.toString("latin1", base, base + 4) !== "desc") continue;
      const offset = icc.readUInt32BE(base + 4);
      const size = icc.readUInt32BE(base + 8);
      if (offset + 8 > icc.length || offset + size > icc.length || size < 12) return null;
      const tagType = icc.toString("latin1", offset, offset + 4);
      if (tagType !== "desc") return null;
      const count = icc.readUInt32BE(offset + 4);
      if (count > 0 && offset + 8 + count <= icc.length) {
        const ascii = icc.toString("latin1", offset + 8, offset + 8 + count).replace(/\0+$/g, "").trim();
        if (ascii) return ascii;
      }
      // v4: reserved long then UTF-16BE description without a length prefix.
      const textOffset = offset + 12;
      if (textOffset + 2 <= icc.length && textOffset < offset + size) {
        const chars: string[] = [];
        for (let j = textOffset; j + 1 < offset + size; j += 2) {
          const code = icc.readUInt16BE(j);
          if (code === 0) break;
          chars.push(String.fromCharCode(code));
        }
        const utf16 = chars.join("").trim();
        if (utf16) return utf16;
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}