"use client";

import { useEffect, useState } from "react";
import { useProtectedAction } from "@/lib/client/permissions";
import { Button } from "./ui/button";
import { JobProgress } from "./job-progress";
import { useJobActivity } from "@/lib/job-activity-context";

interface ReindexResult {
  count?: number;
  failed?: number;
  durationMs?: number;
}

/**
 * Stage 5.1 — Async vector re-index trigger (rewired from server action).
 *
 * CURATOR/ADMIN-only via `useProtectedAction("CURATOR")`. Dispatches a
 * REINDEX_VECTORS background job (POST /api/jobs), streams live progress via
 * JobProgress, and reports the count/failures/duration once the job completes.
 */
export function ReindexButton() {
  const { locked, lockHint, guard } = useProtectedAction("CURATOR");
  const { trackJob } = useJobActivity();
  const [jobId, setJobId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleReindex() {
    if (jobId) return;
    if (!guard()) return;
    setSummary(null);
    setJobId(null);
    setDone(false);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-job-type": "REINDEX_VECTORS" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        let message = "Re-indexing failed.";
        try {
          const payload = (await res.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {
          // keep default
        }
        setSummary(message);
        return;
      }
      const payload = (await res.json()) as { ok: boolean; jobId: string };
      setJobId(payload.jobId);
      trackJob(payload.jobId, "REINDEX_VECTORS", "Re-index vectors");
    } catch {
      setSummary("Re-indexing failed.");
    }
  }

  // Poll status once for the completion summary after the job finishes.
  useEffect(() => {
    if (!jobId || done) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          job?: { status?: string; result?: ReindexResult; error?: string };
        };
        const job = payload.job;
        if (job?.status === "COMPLETED") {
          setDone(true);
          const result = (job.result as ReindexResult) ?? {};
          const count = result.count ?? 0;
          const failures = result.failed && result.failed > 0 ? `, ${result.failed} failed` : "";
          const ms = result.durationMs ?? 0;
          setSummary(`Re-indexed ${count} asset${count === 1 ? "" : "s"} in ${ms} ms${failures}.`);
        } else if (job?.status === "FAILED") {
          setDone(true);
          setSummary(job.error ?? "Re-indexing failed.");
        }
      } catch {
        // ignore aborted/retried polls; summary is a best-effort refresh
      }
    })();
    return () => controller.abort();
  }, [jobId, done]);

  const showProgress = Boolean(jobId) && !done;

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="secondary"
        className="w-full justify-start px-3 py-2 text-xs"
        aria-disabled={locked || Boolean(jobId)}
        title={locked ? lockHint : undefined}
        onClick={() => void handleReindex()}
      >
        {jobId ? "Re-indexing…" : "Re-index vectors"}
      </Button>
      {showProgress && <JobProgress jobId={jobId!} />}
      {summary && <p className="text-[11px] leading-relaxed text-muted">{summary}</p>}
    </div>
  );
}