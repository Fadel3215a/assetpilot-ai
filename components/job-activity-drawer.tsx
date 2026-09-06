"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useJobActivity, type TrackedJob } from "@/lib/job-activity-context";
import type { BackgroundJobType, JobStatus } from "@/types";

/**
 * Stage 2.2 — Floating background job activity drawer.
 *
 * Fixed to the bottom-right corner. Collapsed it renders a compact glassy pill
 * with the running-task spinner, the count of in-flight jobs, and an aggregated
 * progress ring. Expanded it becomes a glassmorphic panel listing every tracked
 * job with its progress bar, status tag, step label, and (for completed ZIP
 * exports) a download button.
 */

const STATUS_STYLES: Record<JobStatus, string> = {
  QUEUED: "border-border bg-surface-elevated text-muted",
  PROCESSING: "border-status-warning/25 bg-status-warning-muted text-status-warning",
  COMPLETED: "border-status-success/25 bg-status-success-muted text-status-success",
  FAILED: "border-status-danger/25 bg-status-danger-muted text-status-danger",
};

const STATUS_LABELS: Record<JobStatus, string> = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

export function JobActivityDrawer() {
  const { trackedJobs, clearCompleted } = useJobActivity();
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(
    () =>
      trackedJobs.filter((job) => job.status === "QUEUED" || job.status === "PROCESSING")
        .length,
    [trackedJobs],
  );

  const overallPercent = useMemo(() => {
    if (trackedJobs.length === 0) return 0;
    const active = trackedJobs.filter(
      (job) => job.status === "QUEUED" || job.status === "PROCESSING",
    );
    if (active.length === 0) return 100;
    const total = active.reduce((sum, job) => sum + job.progressPercent, 0);
    return Math.round(total / active.length);
  }, [trackedJobs]);

  if (trackedJobs.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.button
            key="pill"
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded="false"
            aria-label={`Job activity: ${activeCount} running`}
            className="flex items-center gap-2.5 rounded-full border border-border bg-surface/95 py-2 pl-3 pr-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md transition-[border-color,transform] duration-[var(--duration-fast)] hover:border-accent/30"
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {activeCount > 0 ? <Spinner /> : <DoneMark />}
            <span className="text-sm font-semibold text-foreground">
              {activeCount > 0 ? `${activeCount} running` : "All clear"}
            </span>
            <ProgressRing percent={overallPercent} active={activeCount > 0} />
          </motion.button>
        ) : (
          <motion.div
            key="card"
            role="dialog"
            aria-label="Job activity"
            className="flex w-80 flex-col overflow-hidden rounded-lg border border-border bg-surface/95 shadow-[0_24px_70px_-18px_rgba(0,0,0,0.7)] backdrop-blur-md"
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Job Activity
              </p>
              <div className="flex items-center gap-1.5">
                {activeCount === 0 && (
                  <button
                    type="button"
                    onClick={clearCompleted}
                    className="rounded-sm border border-border bg-surface-elevated px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Collapse job activity"
                  className="rounded-sm border border-border bg-surface-elevated px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:text-foreground"
                >
                  −
                </button>
              </div>
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto p-2.5">
              {trackedJobs.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted">No background jobs.</p>
              ) : (
                trackedJobs.map((job) => <TrackedJobRow key={job.jobId} job={job} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrackedJobRow({ job }: { job: TrackedJob }) {
  const downloading = job.status === "COMPLETED" && job.type === "EXPORT_ZIP";
  const result = (job.result ?? null) as { fileName?: string; base64?: string } | null;

  return (
    <div className="rounded-md border border-border bg-surface-elevated/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-muted">
            <TypeGlyph type={job.type} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-foreground">
              {job.title}
            </span>
            <span className="block truncate font-mono text-[10px] text-muted">
              {job.jobId}
            </span>
          </span>
        </span>
        <StatusTag status={job.status} />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
          <motion.div
            className="h-full rounded-full bg-foreground/70"
            initial={false}
            animate={{ width: `${job.progressPercent}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted">
          {job.progressPercent}%
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] text-muted">
          {job.status === "FAILED"
            ? job.error || "Job failed."
            : job.stepLabel || "Waiting for update…"}
        </p>
        {downloading && result?.base64 && (
          <button
            type="button"
            onClick={() => downloadResult(job)}
            className="shrink-0 rounded-sm border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            Download
          </button>
        )}
      </div>
    </div>
  );
}

function downloadResult(job: TrackedJob) {
  const result = (job.result ?? null) as { fileName?: string; base64?: string } | null;
  if (!result?.base64) return;
  try {
    const bytes = Uint8Array.from(atob(result.base64), (ch) => ch.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName ?? "assetpilot-export.zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch {
    // Base64 decode failed — nothing actionable.
  }
}

function StatusTag({ status }: { status: JobStatus }) {
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function ProgressRing({ percent, active }: { percent: number; active: boolean }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="2.5"
        className="text-muted"
      />
      <motion.circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (circumference * percent) / 100 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={active ? "text-accent" : "text-foreground/60"}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
    </span>
  );
}

function DoneMark() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-status-success-muted text-status-success" aria-hidden="true">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 8.5L6.5 12L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function TypeGlyph({ type }: { type: BackgroundJobType }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      {type === "EXPORT_ZIP" ? (
        <>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </>
      ) : type === "REINDEX_VECTORS" ? (
        <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
      ) : (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" />
        </>
      )}
    </svg>
  );
}