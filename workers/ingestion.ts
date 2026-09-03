import { Worker, type Job } from "bullmq";
import { readFile } from "node:fs/promises";
import {
  deriveRenditions,
  enrichExtractedFileMetadata,
  fileExtensionOf,
  type RenditionPaths,
} from "@/lib/renditions";
import { getCollections } from "@/lib/server/queries";
import {
  applyCurationRules,
  generateAndAttachAnalysis,
  loadAssetForWorker,
  recomputeProductionForWorker,
  writeSnapshot,
} from "@/lib/server/worker-orchestration";
import { QUEUE_NAMES } from "@/lib/queue/queues";
import { getWorkerConnection, isRedisConfigured } from "@/lib/queue/client";
import type { Asset, ExtractedFileMetadata, IngestionJobData } from "@/types";

/**
 * Stage 1.2 — Ingestion worker (pipeline coordinator).
 *
 * Drives the full off-request ingestion pipeline for a newly uploaded file:
 *   1. file parsing / metadata enrichment (server-authoritative values),
 *   2. rendition generation (thumbnail + web preview) on the current version,
 *   3. AI analysis (tags, observations, production verdict),
 *   4. a single atomic database snapshot write.
 *
 * Because every stage mutates the in-memory domain model before one
 * writeSnapshot() commit, the pipeline is consistent and avoids partial writes.
 */

const DEFAULT_CONCURRENCY = 2;

const PROMOTION_ACTION = "Auto-promoted to production ready (curation rules)";

function attachRenditionsToCurrentVersion(
  asset: Asset,
  renditions: RenditionPaths | null,
): Asset {
  if (!renditions) return asset;
  return {
    ...asset,
    versions: asset.versions.map((v) =>
      v.isCurrent
        ? {
            ...v,
            thumbnailPath: renditions.thumbnailPath,
            previewPath: renditions.previewPath,
          }
        : v,
    ),
  };
}

async function processIngestion(job: Job<IngestionJobData>): Promise<void> {
  const { assetId, filePath, mimeType, collectionId } = job.data;

  const loaded = await loadAssetForWorker(assetId);
  if (!loaded) {
    throw new Error(`Ingestion: asset ${assetId} not found`);
  }
  const { domain, aiSessionState: session } = loaded;

  job.log(`Parsing source file for asset ${assetId} (${mimeType})`);

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    throw new Error(`Ingestion: unable to read source file ${filePath}: ${(error as Error).message}`);
  }

  const ext = fileExtensionOf(filePath);

  // 1. File parsing: enrich client metadata with server-authoritative values.
  let updated: Asset = domain;
  if (ext) {
    const base: ExtractedFileMetadata =
      domain.extractedMetadata ?? {
        fileName: filePath,
        extension: ext,
        mimeType,
        fileSize: buffer.byteLength,
      };
    updated = { ...domain, extractedMetadata: await enrichExtractedFileMetadata(base, buffer, ext) };
  }

  // 2. Rendition generation for the current version.
  const renditions = await deriveRenditions(buffer, assetId, ext);
  updated = attachRenditionsToCurrentVersion(updated, renditions);
  if (renditions) {
    job.log(`Derived renditions for version ${updated.currentVersionId} (${collectionId})`);
  }

  // 3. AI analysis.
  const collections = await getCollections();
  updated = await generateAndAttachAnalysis(updated, collections);
  updated = recomputeProductionForWorker(updated);

  // 4. Curation gate + atomic snapshot.
  const { domain: curated, promoted } = applyCurationRules(updated, session);
  updated = curated;

  await writeSnapshot(updated);

  job.log(`Ingestion complete for asset ${assetId} -> snapshot persisted`);
  if (promoted) {
    job.log(`Ingestion promoted ${assetId} to PRODUCTION_READY via curation rules (${PROMOTION_ACTION})`);
  }
}

export function createIngestionWorker(): Worker<IngestionJobData> | null {
  if (!isRedisConfigured()) {
    console.warn('[ingestion-worker] Redis is not configured; ingestion worker is disabled.');
    return null;
  }
  const worker = new Worker<IngestionJobData>(
    QUEUE_NAMES.ingestion,
    processIngestion,
    {
      connection: getWorkerConnection(),
      concurrency: DEFAULT_CONCURRENCY,
    },
  );

  worker.on("ready", () => console.log(`[ingestion-worker] ready on "${QUEUE_NAMES.ingestion}"`));
  worker.on("failed", (job, error) => {
    console.error(`[ingestion-worker] job ${job?.id} failed:`, error);
  });

  return worker;
}
