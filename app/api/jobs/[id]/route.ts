import { backgroundQueue } from "@/lib/queue/queues";
import { jobStore } from "@/lib/queue/job-store";
import { isRedisConfigured } from "@/lib/queue/client";
import { requireRequestRole } from "@/lib/auth";
import type { BackgroundJobState, JobStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stage 5.1 — Job status lookup.
 *
 * `GET /api/jobs/[id]` returns the normalized `BackgroundJobState` for a
 * background job. State is sourced from the in-memory jobStore first (populated
 * at enqueue time in both Redis and fallback modes); when Redis is configured it
 * is merged with live BullMQ state (progress, `returnvalue` -> result,
 * `failedReason` -> error) so large/retried jobs stay accurate even if the
 * web process differs from the one that enqueued them.
 */

interface RawProgress {
  progressPercent?: number;
  stepLabel?: string;
}

function progressOf(raw: unknown): RawProgress {
  if (raw && typeof raw === "object") {
    const p = raw as RawProgress;
    return {
      progressPercent: typeof p.progressPercent === "number" ? p.progressPercent : 0,
      stepLabel: typeof p.stepLabel === "string" ? p.stepLabel : "",
    };
  }
  return { progressPercent: 0, stepLabel: "" };
}

function mapState(state: string): JobStatus | null {
  switch (state) {
    case "completed":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    case "active":
      return "PROCESSING";
    case "waiting":
    case "waiting-children":
    case "delayed":
    case "prioritized":
      return "QUEUED";
    default:
      return null;
  }
}

function mergeBullmq(
  state: BackgroundJobState,
  status: JobStatus,
  progress: RawProgress,
  result: unknown,
  error?: string,
): BackgroundJobState {
  const merged: BackgroundJobState = { ...state, status };
  if (status === "COMPLETED") {
    merged.progressPercent = 100;
    merged.stepLabel = progress.stepLabel || "Complete";
    if (result !== undefined && result !== null) merged.result = result;
    merged.error = undefined;
  } else if (status === "FAILED") {
    merged.stepLabel = progress.stepLabel || "Failed";
    merged.error = error || state.error;
  } else if (status === "PROCESSING") {
    merged.progressPercent = progress.progressPercent ?? merged.progressPercent;
    merged.stepLabel = progress.stepLabel || "Processing…";
  } else if (status === "QUEUED") {
    merged.progressPercent = 0;
    merged.stepLabel = "Queued";
  } else {
    merged.progressPercent = progress.progressPercent ?? merged.progressPercent;
  }
  return merged;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireRequestRole(request, "VIEWER");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const jobId = id;

  const base = jobStore.get(jobId);
  if (!base) {
    return new Response(JSON.stringify({ ok: false, error: `Job ${jobId} not found.` }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  let state: BackgroundJobState = base;

  if (isRedisConfigured()) {
    try {
      const job = await backgroundQueue.getJob(jobId);
      if (job) {
        const rawState = await job.getState();
        const bmqStatus = mapState(rawState);
        if (bmqStatus) {
          const progress = progressOf(job.progress);
          state = mergeBullmq(state, bmqStatus, progress, job.returnvalue, job.failedReason ?? undefined);
        }
      }
    } catch (error) {
      console.error(`[jobs] looking up ${jobId} in background queue failed`, error);
    }
  }

  return new Response(JSON.stringify({ ok: true, job: state }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}