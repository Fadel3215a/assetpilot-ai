import type { ActivitySource } from "./asset";

export type UploadCategory = "image" | "video" | "audio" | "3d" | "other";

export interface ExtractedExifData {
  make?: string;
  model?: string;
  orientation?: number;
  dateTime?: string;
  dateTimeOriginal?: string;
  iso?: number;
  fNumber?: number;
  exposureTime?: number;
  focalLengthIn35mm?: number;
  lensModel?: string;
}

export interface ExtractedFileMetadata {
  fileName: string;
  extension: string;
  mimeType: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  duration?: number;
  lastModified?: number;
  /** width / height of the orient-corrected media, e.g. 1.778 */
  aspectRatio?: number;
  /** sharp colorspace name (srgb, p3, cmyk, ...) for raster images */
  colorSpace?: string;
  /** ICC color profile name when present and parseable, otherwise null */
  iccProfile?: string | null;
  hasAlpha?: boolean;
  /** bits per channel for raster images (8, 16, 32, 64) */
  bitDepth?: number;
  /** raw EXIF orientation value (1..8) */
  orientation?: number;
  exif?: ExtractedExifData;
}

export interface DuplicateCandidate {
  id: string;
  assetId: string;
  candidateAssetId: string;
  candidateName: string;
  reason: string;
  evidence: string[];
}

export interface RelatedAsset {
  assetId: string;
  assetName: string;
  reasons: string[];
  score: number;
}

export type AssetHealthStatus = "complete" | "partial" | "missing" | "pending";

export interface AssetHealthItem {
  id: string;
  label: string;
  status: AssetHealthStatus;
  detail?: string;
}

export interface AssetHealth {
  items: AssetHealthItem[];
  completeCount: number;
  totalCount: number;
}

export interface AssetTimelineEntry {
  id: string;
  assetId: string;
  timestamp: string;
  action: string;
  source: ActivitySource | "system";
}

export interface MetadataEditPayload {
  name: string;
  description: string;
  tags: string[];
  collectionId: string;
  usageNotes: string;
}

export interface AssetFilterState {
  search: string;
  type: string;
  status: string;
  collection: string;
  priority: string;
  minQuality: string;
  productionReady: string;
}
