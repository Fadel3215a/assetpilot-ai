/**
 * Stage 1.1 — Background job payload contracts (BullMQ).
 *
 * These define the data each worker is expected to receive when it picks up a
 * job from the ingestion, AI-analysis, or rendition queues.
 */

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

/**
 * Live progress payload broadcast over the job-progress SSE stream
 * (`GET /api/jobs/[id]/progress`). Emitted as `data:` chunks while a worker
 * processes a BullMQ job, and as the terminal payload when the job completes,
 * fails, or when a fallback (no Redis / job not found) is used.
 */
export interface JobProgressPayload {
  /** Id of the job being tracked. */
  jobId: string;
  /** Current lifecycle status of the job. */
  status: JobStatus;
  /** 0..100 progress estimate for the current pipeline. */
  progressPercent: number;
  /** Human-readable label for the current/most-recent pipeline step. */
  stepLabel: string;
  /** Present when the job has failed (a human-readable reason). */
  error?: string;
  /** Terminal result of a completed job (e.g. export ZIP metadata). */
  result?: unknown;
}

/**
 * Payload for the asset-ingestion queue. Consumed when a raw file must be
 * normalized, metadata-extracted, and persisted as a versioned asset.
 */
export interface IngestionJobData {
  /** Id of the asset this ingestion contributes to. */
  assetId: string;
  /** Absolute (or public) path to the uploaded source file. */
  filePath: string;
  /** MIME type of the source file, used to pick the right pipeline. */
  mimeType: string;
  /** Id of the collection the asset should be filed under. */
  collectionId: string;
}

/**
 * Payload for the AI-analysis queue. Duration and cost make this the natural
 * candidate for async background processing.
 */
export interface AIAnalysisJobData {
  assetId: string;
  versionId: string;
  /**
   * Which analyses to run, e.g. ["compactMetadata", "tags",
   * "productionReadiness"]. Kept open-ended so callers can request a subset.
   */
  targets: string[];
}

/**
 * Payload for the rendition queue. Produces derivative media (thumbnails,
 * previews, web-optimized forms) from a source file.
 */
export interface RenditionJobData {
  assetId: string;
  versionId: string;
  /** Path to the source file to derive renditions from. */
  filePath: string;
  /** Media type, e.g. "image" | "video" | "audio". */
  mediaType: string;
}

/**
 * Stage 5.1 — Unified background job dispatch (EXPORT_ZIP, CONVERT_RENDITION,
 * REINDEX_VECTORS). A job stores its full lifecycle (id, type, status,
 * progress, result, error) either in BullMQ (production, Redis) or the
 * in-memory `lib/queue/job-store` fallback runner.
 */
export type BackgroundJobType =
  | "EXPORT_ZIP"
  | "CONVERT_RENDITION"
  | "REINDEX_VECTORS";

/** Selects which assets an EXPORT_ZIP job packages. */
export interface ExportZipJobData {
  assetIds?: string[];
  collectionId?: string;
  label?: string;
}

/**
 * Re-derives one or more asset versions' derivative media (thumbnail/preview).
 * Accepts a single assetId/versionId (the UI flow) or a collectionId / assetIds
 * array for bulk regeneration. When no target is given, the asset's current
 * version is used (or the current version of every selected asset for bulk).
 */
export interface ConvertRenditionJobData {
  /** Single-asset target. Optional when assetIds[] or collectionId is set. */
  assetId?: string;
  /** The specific version to regenerate. Defaults to the asset's current version. */
  versionId?: string;
  /** Bulk target: derive renditions for every version of these assets. */
  assetIds?: string[];
  /** Bulk target: derive renditions for every asset in this collection. */
  collectionId?: string;
}

/** Invalidates + rebuilds the inventory's hybrid search embeddings. */
export interface ReindexVectorsJobData {
  collectionId?: string;
}

export type BackgroundJobData =
  | ExportZipJobData
  | ConvertRenditionJobData
  | ReindexVectorsJobData;

/**
 * Normalized lifecycle record for a background job. `status: "QUEUED"` is the
 * pending state surfaced to the UI; terminal states carry `result` (completed)
 * or `error` (failed).
 */
export interface BackgroundJobState {
  id: string;
  type: BackgroundJobType;
  status: JobStatus;
  progressPercent: number;
  stepLabel: string;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
