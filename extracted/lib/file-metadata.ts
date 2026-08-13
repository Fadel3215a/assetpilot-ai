import type { ExtractedFileMetadata, UploadCategory } from "@/types";

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function categoryFromMime(mime: string, ext: string): UploadCategory {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (["glb", "gltf", "obj", "fbx", "usdz"].includes(ext)) return "3d";
  return "other";
}

function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions"));
    img.src = url;
  });
}

function loadMediaDuration(url: string, tag: "video" | "audio"): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      resolve(el.duration);
      el.removeAttribute("src");
      el.load();
    };
    el.onerror = () => reject(new Error(`Could not read ${tag} duration`));
    el.src = url;
  });
}

export function inferUploadCategory(file: File): UploadCategory {
  const ext = getExtension(file.name);
  return categoryFromMime(file.type, ext);
}

export async function extractFileMetadata(file: File): Promise<ExtractedFileMetadata> {
  const extension = getExtension(file.name);
  const base: ExtractedFileMetadata = {
    fileName: file.name,
    extension,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    lastModified: file.lastModified,
  };

  const category = inferUploadCategory(file);
  const objectUrl = URL.createObjectURL(file);

  try {
    if (category === "image") {
      const dimensions = await loadImageDimensions(objectUrl);
      return { ...base, dimensions };
    }
    if (category === "video") {
      const duration = await loadMediaDuration(objectUrl, "video");
      return { ...base, duration: Math.round(duration * 10) / 10 };
    }
    if (category === "audio") {
      const duration = await loadMediaDuration(objectUrl, "audio");
      return { ...base, duration: Math.round(duration * 10) / 10 };
    }
  } catch {
    // Return base metadata when media probes fail
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return base;
}

export function mapCategoryToAssetType(category: UploadCategory): import("@/types").AssetType {
  if (category === "other") return "other";
  return category;
}
