import { enqueueBackgroundJob } from "@/lib/queue/jobs";
import { jobStore } from "@/lib/queue/job-store";
import { requireRequestWorkspace } from "@/lib/server/workspace-context";
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

  const auth = await requireRequestWorkspace(request, MIN_ROLES[jobType]);
  if (auth instanceof Response) return auth;

  let rawBody: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      rawBody = parsed as Record<string, unknown>;
    }
  } catch {
    rawBody = {};
  }

  // P0.2 — workspace identity is server-owned: any client-supplied workspaceId
  // is discarded and the caller's resolved workspace is stamped instead.
  delete rawBody.workspaceId;
  const data = { ...rawBody, workspaceId: auth.workspaceId } as BackgroundJobData;

  try {
    const jobId = await enqueueBackgroundJob(jobType, data);
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