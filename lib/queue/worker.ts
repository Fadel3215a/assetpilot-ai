import { Worker, type Job } from "bullmq";
import { executeBackgroundJob } from "@/lib/queue/job-executor";
import { QUEUE_NAMES } from "@/lib/queue/queues";
import { getWorkerConnection, isRedisConfigured } from "@/lib/queue/client";
import type { BackgroundJobData, BackgroundJobType } from "@/types";

/**
 * Stage 5.1 — Dispatcher worker.
 *
 * Consumes the unified `background` queue (EXPORT_ZIP, CONVERT_RENDITION,
 * REINDEX_VECTORS). Each job's `data.type` selects the executor handler, and
 * progress is forwarded through `job.updateProgress` so the `/api/jobs/[id]/progress`
 * SSE endpoint can relay live state. The processor's return value becomes the
 * BullMQ `returnvalue`, surfaced by `GET /api/jobs/[id]` (and the SSE terminal
 * payload) as the job `result`.
 */

async function processBackgroundJob(job: Job<BackgroundJobData>): Promise<unknown> {
  const type = job.name as BackgroundJobType | undefined;
  if (!type) {
    throw new Error(`Background job ${job.id} is missing a "type".`);
  }

  return executeBackgroundJob({
    type,
    data: job.data,
    report: (progressPercent, stepLabel) => {
      // Fire-and-forget update: progress reporting is best-effort and must never
      // surface as an unhandled rejection (e.g. a transient Redis hiccup mid-job).
      void job.updateProgress({ progressPercent, stepLabel }).catch(() => {
        /* progress telemetry is best-effort */
      });
    },
  });
}

export function createBackgroundWorker(): Worker<BackgroundJobData> | null {
  if (!isRedisConfigured()) {
    console.warn('[background-worker] Redis is not configured; background worker is disabled.');
    return null;
  }
  const worker = new Worker<BackgroundJobData>(QUEUE_NAMES.background, processBackgroundJob, {
    connection: getWorkerConnection(),
    concurrency: 2,
  });

  worker.on("ready", () => console.log(`[background-worker] ready on "${QUEUE_NAMES.background}"`));
  worker.on("failed", (job, error) => {
    console.error(`[background-worker] job ${job?.id} failed:`, error);
  });

  return worker;
}