"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { JobProgress } from "./job-progress";
import { useJobActivity } from "@/lib/job-activity-context";

interface ExportZipButtonProps {
  /** Specific assets to include in the ZIP. */
  assetIds?: string[];
  /** All assets in a collection. */
  collectionId?: string;
  label?: string;
  disabled?: boolean;
}

interface ExportResult {
  fileName?: string;
  sizeBytes?: number;
  base64?: string;
}

/**
 * Stage 5.1 — Async ZIP export trigger (rewired from /api/export/stream).
 *
 * Dispatches an EXPORT_ZIP background job (POST /api/jobs), streams live
 * progress via JobProgress, and — once the job reports COMPLETED with a base64
 * ZIP in its result — hands the bundle to the browser as a download.
 */
export function ExportZipButton({
  assetIds = [],
  collectionId,
  label = "Export ZIP",
  disabled = false,
}: ExportZipButtonProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trackJob } = useJobActivity();

  const jobTitle = collectionId
    ? "Export collection ZIP"
    : `Export ${assetIds.length > 0 ? `${assetIds.length} asset${assetIds.length === 1 ? "" : "s"}` : "all assets"} ZIP`;

  const handleExport = async () => {
    setError(null);
    setJobId(null);
    setDownloaded(false);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-job-type": "EXPORT_ZIP" },
        body: JSON.stringify({
          ...(assetIds.length > 0 ? { assetIds: [...new Set(assetIds)] } : {}),
          ...(collectionId ? { collectionId } : {}),
        }),
      });

      if (!response.ok) {
        let message = "Export failed. Please try again.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {
          // Non-JSON error body — keep the default message.
        }
        setError(message);
        return;
      }

      const payload = (await response.json()) as { ok: boolean; jobId: string };
      setJobId(payload.jobId);
      trackJob(payload.jobId, "EXPORT_ZIP", jobTitle);
    } catch {
      setError("Export failed. Please try again.");
    }
  };

  // Download the completed ZIP exactly once a terminal result arrives.
  useEffect(() => {
    if (!jobId || downloaded) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { job?: { status?: string; result?: ExportResult } };
        const job = payload.job;
        if (job?.status !== "COMPLETED") return;
        const result = job.result as ExportResult | undefined;
        if (!result?.base64) return;

        setDownloaded(true);
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
        // Ignore aborted/short polls; the SSE stream is the primary signal.
      }
    })();

    return () => controller.abort();
  }, [jobId, downloaded]);

  const showProgress = Boolean(jobId) && !downloaded && !error;

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => void handleExport()}
        disabled={disabled || Boolean(jobId)}
      >
        {jobId ? "Preparing…" : label}
      </Button>
      {showProgress && jobId && <JobProgress jobId={jobId} />}
      {error && (
        <p className="text-xs text-status-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}