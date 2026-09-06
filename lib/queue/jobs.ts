import { isRedisConfigured } from "@/lib/queue/client";
import { generateJobId, jobStore } from "@/lib/queue/job-store";
import { executeBackgroundJob } from "@/lib/queue/job-executor";
import { backgroundQueue } from "@/lib/queue/queues";
import type {
  BackgroundJobData,
  BackgroundJobState,
  BackgroundJobType,
} from "@/types";

/**
 * Stage 5.1 — Background job dispatch (the UI-facing entry point).
 *
 * `enqueueBackgroundJob` always records an initial QUEUED state in the in-memory
 * jobStore (so `GET /api/jobs/[id]` and the SSE route have something to find),
 * then either:
 *   - enqueues the job into BullMQ with the same jobId (production, Redis), or
 *   - schedules the in-process fallback runner (no Redis), which executes the
 *     job off the request path and streams progress through the jobStore.
 *
 * In both modes the id is deterministic (jobStore  + BullMQ both key on it), so
 * a client can immediately open the SSE progress stream.
 */

/** Creates the normalized QUEUED record. */
function initialState(type: BackgroundJobType, id: string): BackgroundJobState {
  const now = Date.now();
  return {
    id,
    type,
    status: "QUEUED",
    progressPercent: 0,
    stepLabel: "Queued",
    createdAt: now,
    updatedAt: now,
  };
}

/** Schedules the in-process fallback runner when Redis is unavailable. */
function scheduleInProcess(type: BackgroundJobType, id: string, data: BackgroundJobData): void {
  setImmediate(() => {
    const apply = (state: Partial<BackgroundJobState>) => {
      jobStore.upsert({ ...(jobStore.get(id) ?? initialState(type, id)), ...state });
    };

    try {
      executeBackgroundJob({
        type,
        data,
        report: (progressPercent, stepLabel) =>
          apply({ status: "PROCESSING", progressPercent, stepLabel }),
      })
        .then((result) => {
          jobStore.upsert({
            ...(jobStore.get(id) ?? initialState(type, id)),
            status: "COMPLETED",
            progressPercent: 100,
            stepLabel: "Complete",
            result,
            error: undefined,
          });
        })
        .catch((error: unknown) => {
          jobStore.upsert({
            ...(jobStore.get(id) ?? initialState(type, id)),
            status: "FAILED",
            progressPercent: 0,
            stepLabel: "Failed",
            error: (error as Error).message ?? String(error),
          });
        });
    } catch (error) {
      jobStore.upsert({
        ...(jobStore.get(id) ?? initialState(type, id)),
        status: "FAILED",
        progressPercent: 0,
        stepLabel: "Failed",
        error: (error as Error)?.message ?? String(error),
      });
    }
  });
}

export async function enqueueBackgroundJob(
  type: BackgroundJobType,
  data: BackgroundJobData,
): Promise<string> {
  const id = generateJobId();
  jobStore.upsert(initialState(type, id));

  if (isRedisConfigured()) {
    await backgroundQueue.add(type, data, { jobId: id });
  } else {
    scheduleInProcess(type, id, data);
  }

  return id;
}