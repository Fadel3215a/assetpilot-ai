import { Worker, type Job } from "bullmq";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { deriveRenditions, fileExtensionOf } from "@/lib/renditions";
import { QUEUE_NAMES } from "@/lib/queue/queues";
import { getWorkerConnection, isRedisConfigured } from "@/lib/queue/client";
import type { RenditionJobData } from "@/types";

/**
 * Stage 1.2 — Rendition worker.
 *
 * Picks up rendition jobs and derives the derivative media (300px thumbnail,
 * 1080px web preview) for an asset version's source file, then persists the
 * resulting `/media/` paths on the AssetVersion row in PostgreSQL.
 *
 * The source file is read from disk (the path supplied at enqueue time) because
 * the derivation pipeline operates on raw bytes.
 */

const DEFAULT_CONCURRENCY = 3;

/** Best-effort live progress reporting for the /api/jobs/[id]/progress SSE stream. */
function report(job: Job<RenditionJobData>, progressPercent: number, stepLabel: string): void {
  void job.updateProgress({ progressPercent, stepLabel });
}

async function processRendition(job: Job<RenditionJobData>): Promise<void> {
  const { assetId, versionId, filePath, mediaType } = job.data;

  const ext = fileExtensionOf(filePath) || path.extname(filePath).toLowerCase();

  report(job, 20, "Reading source file…");
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    throw new Error(`Rendition: unable to read source file ${filePath}: ${(error as Error).message}`);
  }

  report(job, 50, "Deriving renditions…");
  const rendition = await deriveRenditions(buffer, assetId, ext);

  report(job, 85, "Persisting renditions…");
  if (rendition) {
    await prisma.assetVersion.update({
      where: { id: versionId },
      data: {
        thumbnailPath: rendition.thumbnailPath,
        previewPath: rendition.previewPath,
      },
    });
    report(job, 100, "Complete");
    job.log(`Persisted renditions for version ${versionId} (${mediaType})`);
  } else {
    job.log(`No renditions derived for ${versionId} (mediaType=${mediaType}, ext=${ext})`);
  }
}

export function createRenditionWorker(): Worker<RenditionJobData> | null {
  if (!isRedisConfigured()) {
    console.warn('[rendition-worker] Redis is not configured; rendition worker is disabled.');
    return null;
  }
  const worker = new Worker<RenditionJobData>(
    QUEUE_NAMES.rendition,
    processRendition,
    {
      connection: getWorkerConnection(),
      concurrency: DEFAULT_CONCURRENCY,
    },
  );

  worker.on("ready", () => console.log(`[rendition-worker] ready on "${QUEUE_NAMES.rendition}"`));
  worker.on("failed", (job, error) => {
    console.error(`[rendition-worker] job ${job?.id} failed:`, error);
  });

  return worker;
}
