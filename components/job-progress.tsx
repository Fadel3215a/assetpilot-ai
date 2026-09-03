"use client";

import type { JobStatus } from "@/types";
import { useJobProgress } from "@/lib/use-job-progress";

/**
 * Stage 1.3 — Real-time ingestion progress indicator.
 *
 * Subscribes a live job-progress stream (via `useJobProgress`) and renders the
 * current status, step label, and a coarse progress bar for a background job.
 * Falls back to a subtle "idle" row while the stream is disconnected/no payload
 * has arrived yet.
 */

const statusStyles: Record<JobStatus, string> = {
  QUEUED: "bg-status-neutral-muted text-status-neutral border-border",
  PROCESSING: "bg-status-warning-muted text-status-warning border-status-warning/20",
  COMPLETED: "bg-status-success-muted text-status-success border-status-success/20",
  FAILED: "bg-status-danger-muted text-status-danger border-status-danger/20",
};

const statusLabels: Record<JobStatus, string> = {
  QUEUED: "Queued",
  PROCESSING: "Processing",
  COMPLETED: "Complete",
  FAILED: "Failed",
};

export function JobProgress({ jobId }: { jobId: string }) {
  const { payload, connected } = useJobProgress(jobId);

  const status = payload?.status ?? "QUEUED";
  const step = payload?.stepLabel || (connected ? "Waiting for update…" : "Connecting…");
  const percent = Math.max(0, Math.min(100, payload?.progressPercent ?? 0));

  return (
    <div className="rounded-md border border-border bg-surface p-3 text-xs" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Pipeline progress</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${statusStyles[status]}`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-current" : "bg-current opacity-40"}`}
          />
          {statusLabels[status]}
        </span>
      </div>

      <p className="mt-2 truncate text-muted">{step}</p>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-muted/40">
        <div
          className="h-full bg-foreground/70 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-muted">{percent}%</p>
    </div>
  );
}
