import type { ActivitySource } from "./asset";

export type UploadCategory = "image" | "video" | "audio" | "3d" | "other";

export interface ExtractedFileMetadata {
  fileName: string;
  extension: string;
  mimeType: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  duration?: number;
  lastModified?: number;
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
