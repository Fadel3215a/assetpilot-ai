import { enqueueBackgroundJob } from "@/lib/queue/jobs";
import { jobStore } from "@/lib/queue/job-store";
import { requireRequestRole } from "@/lib/auth";
import type { BackgroundJobData, BackgroundJobType } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stage 5.1 — Job dispatch endpoint.
 *
 * `POST /api/jobs` enqueues a background job (EXPORT_ZIP, CONVERT_RENDITION,
 * REINDEX_VECTORS) for async processing. It is role-gated per job type:
 *   - EXPORT_ZIP          -> VIEWER (any signed-in user may export)
 *   - CONVERT_RENDITION   -> CURATOR
 *   - REINDEX_VECTORS     -> CURATOR
 *
 * Returns `{ ok, jobId, job }` where `job` is the normalized QUEUED state; the
 * client may immediately open `GET /api/jobs/[id]/progress` (SSE) to stream
 * live progress.
 */

const MIN_ROLES: Record<BackgroundJobType, "VIEWER" | "CURATOR"> = {
  EXPORT_ZIP: "VIEWER",
  CONVERT_RENDITION: "CURATOR",
  REINDEX_VECTORS: "CURATOR",
};

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get("x-job-type") ?? "";
  if (!type || !(type in MIN_ROLES)) {
    return badRequest(
      `Missing or unknown "x-job-type". Expected one of: ${Object.keys(MIN_ROLES).join(", ")}.`,
    );
  }
  const jobType = type as BackgroundJobType;

  const auth = await requireRequestRole(request, MIN_ROLES[jobType]);
  if (auth instanceof Response) return auth;

  let body: BackgroundJobData = {};
  try {
    const raw = await request.json();
    body = (raw ?? {}) as BackgroundJobData;
  } catch {
    body = {};
  }

  try {
    const jobId = await enqueueBackgroundJob(jobType, body);
    const job = jobStore.get(jobId);
    return new Response(JSON.stringify({ ok: true, jobId, job }), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error(`[jobs] enqueue ${jobType} failed`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: (error as Error).message ?? "Failed to enqueue job.",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}