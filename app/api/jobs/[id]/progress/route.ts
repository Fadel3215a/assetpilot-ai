import { isRedisConfigured } from "@/lib/queue/client";
import {
  aiAnalysisQueue,
  ingestionQueue,
  renditionQueue,
} from "@/lib/queue/queues";
import { requireRequestRole } from "@/lib/auth";
import type { JobProgressPayload, JobStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stage 1.3 — Real-time job progress gateway.
 *
 * `GET /api/jobs/[id]/progress` is a Server-Sent-Events endpoint that streams a
 * `JobProgressPayload` (`data:` chunks) for a BullMQ background job. Workers
 * report `{ progressPercent, stepLabel }` via `job.updateProgress` at each major
 * pipeline step; this route polls the three queues and relays the latest state.
 *
 * Fallbacks (both emit a clean terminal COMPLETED payload):
 *   - Redis is unconfigured -> there is no job to observe.
 *   - the job is not found in any queue within the polling window.
 */

const POLL_INTERVAL_MS = 1000;
const MAX_STREAM_MS = 60_000;

const encoder = new TextEncoder();

/** Maps a BullMQ job state to our domain JobStatus (or null when unresolvable). */
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

/**
 * Searches every queue for the job and returns a normalized progress payload,
 * or null when the job is not present in any queue.
 */
async function findJob(
  jobId: string,
): Promise<{ payload: JobProgressPayload; done: boolean } | null> {
  const queues = [ingestionQueue, aiAnalysisQueue, renditionQueue];

  for (const queue of queues) {
    const job = await queue.getJob(jobId);
    if (!job) continue;

    const status = mapState(await job.getState());
    if (!status) return null;

    const { progressPercent = 0, stepLabel = "" } = progressOf(job.progress);
    const error =
      status === "FAILED" && typeof job.failedReason === "string" ? job.failedReason : undefined;

    let percent = progressPercent;
    let label = stepLabel;
    if (status === "COMPLETED") {
      percent = 100;
      label = stepLabel || "Complete";
    } else if (status === "FAILED") {
      label = stepLabel || "Failed";
    } else if (status === "PROCESSING") {
      label = stepLabel || "Processing…";
    } else if (status === "QUEUED") {
      label = stepLabel || "Queued";
    }

    const payload: JobProgressPayload = {
      jobId,
      status,
      progressPercent: percent,
      stepLabel: label,
      ...(error ? { error } : {}),
    };
    return { payload, done: status === "COMPLETED" || status === "FAILED" };
  }

  return null;
}

function fallback(jobId: string): JobProgressPayload {
  return { jobId, status: "COMPLETED", progressPercent: 100, stepLabel: "Complete" };
}

const sse = (chunk: JobProgressPayload): string => `event: progress\ndata: ${JSON.stringify(chunk)}\n\n`;

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireRequestRole(request, "VIEWER");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const jobId = id || "unknown";

  // No live broker -> no job to observe; emit a clean terminal payload.
  if (!isRedisConfigured()) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sse(fallback(jobId))));
        controller.close();
      },
    });
    return sseResponse(stream);
  }

  const deadline = Date.now() + MAX_STREAM_MS;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let foundAny = false;

      while (Date.now() < deadline) {
        let result: { payload: JobProgressPayload; done: boolean } | null = null;
        try {
          result = await findJob(jobId);
        } catch (error) {
          console.error(`[jobs/progress] polling ${jobId} failed`, error);
        }

        if (result) {
          foundAny = true;
          controller.enqueue(encoder.encode(sse(result.payload)));
          if (result.done) break;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      // Job was never observed -> graceful terminal fallback.
      if (!foundAny) {
        controller.enqueue(encoder.encode(sse(fallback(jobId))));
      }
      controller.close();
    },
  });

  return sseResponse(stream);
}
