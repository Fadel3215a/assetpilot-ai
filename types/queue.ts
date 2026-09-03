/**
 * Stage 1.1 — Background job payload contracts (BullMQ).
 *
 * These define the data each worker is expected to receive when it picks up a
 * job from the ingestion, AI-analysis, or rendition queues.
 */

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

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
