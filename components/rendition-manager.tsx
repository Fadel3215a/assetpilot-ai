"use client";

import { useEffect, useState } from "react";
import { useProtectedAction } from "@/lib/client/permissions";
import { useJobProgress } from "@/lib/use-job-progress";
import { JobProgress } from "./job-progress";
import { Button } from "./ui/button";

interface VersionRendition {
  versionId: string;
  versionNumber: number;
  label: string;
  isCurrent: boolean;
  thumbnailPath: string;
  previewPath: string;
  thumbnailExists: boolean;
  previewExists: boolean;
}

interface RenditionsApiShape {
  ok: boolean;
  error?: string;
  assetId?: string;
  currentVersionId?: string;
  versions?: VersionRendition[];
}

type LoadState = "loading" | "ready" | "error";

/**
 * Stage 5.2 — Rendition manager panel.
 *
 * Shows the asset's active versions and the current thumbnail/preview rendition
 * state (path + on-disk existence) from `/api/assets/[id]/renditions`, with a
 * CURATOR-gated "Regenerate" control that dispatches a CONVERT_RENDITION job
 * and streams live progress via JobProgress. The rendition list refreshes once
 * a job completes.
 */
export function RenditionManager({ assetId }: { assetId: string }) {
  const { locked, lockHint, guard, canCurate } = useProtectedAction("CURATOR");
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<RenditionsApiShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Fetch rendition state on mount and once more after a terminal job completes.
  const { payload } = useJobProgress(jobId);
  const jobTerminal = payload?.status === "COMPLETED" || payload?.status === "FAILED";
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/renditions`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const payload = (await res.json()) as { error?: string };
          setError(payload.error ?? "Could not load renditions.");
          setState("error");
          return;
        }
        const result = (await res.json()) as RenditionsApiShape;
        setData(result);
        setState("ready");
      } catch {
        if (!controller.signal.aborted) {
          setError("Could not load renditions.");
          setState("error");
        }
      }
    })();
    return () => controller.abort();
  }, [assetId, jobId, jobTerminal]);

  async function handleRegenerate(versionId?: string) {
    if (!guard()) return;
    setJobId(null);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/renditions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(versionId ? { versionId } : {}),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        setError(payload.error ?? "Failed to start rendition regeneration.");
        return;
      }
      const payload = (await res.json()) as { jobId: string };
      setJobId(payload.jobId);
    } catch {
      setError("Failed to start rendition regeneration.");
    }
  }

  const regenerating = Boolean(jobId) && !jobTerminal;

  return (
    <section className="editorial-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="section-title">Renditions</h3>
          <p className="mt-1 text-xs text-muted">
            Thumbnail and preview derivatives for this asset&apos;s versions.
          </p>
        </div>
        {canCurate && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleRegenerate()}
            disabled={locked || regenerating}
            title={locked ? lockHint : undefined}
          >
            {regenerating ? "Regenerating…" : "Regenerate Renditions"}
          </Button>
        )}
      </div>

      {state === "loading" && <p className="mt-4 text-sm text-muted">Loading renditions…</p>}

      {state === "error" && (
        <p role="alert" className="mt-4 text-sm text-status-danger">
          {error}
        </p>
      )}

      {regenerating && jobId && (
        <div className="mt-4">
          <JobProgress jobId={jobId} />
        </div>
      )}

      {state === "ready" && data?.versions && (
        <div className="mt-4 space-y-3">
          {data.versions.map((version) => (
            <div
              key={version.versionId}
              className="rounded-md border border-border bg-surface p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  v{version.versionNumber} · {version.label || "Version"}
                </span>
                {version.isCurrent && (
                  <span className="rounded-sm border border-accent/25 bg-accent/5 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                    Current
                  </span>
                )}
                {canCurate && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-auto h-auto px-2 py-1 text-xs"
                    onClick={() => void handleRegenerate(version.versionId)}
                    disabled={locked || regenerating}
                  >
                    Regenerate
                  </Button>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <RenditionRow label="Thumbnail" path={version.thumbnailPath} exists={version.thumbnailExists} />
                <RenditionRow label="Preview" path={version.previewPath} exists={version.previewExists} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RenditionRow({
  label,
  path,
  exists,
}: {
  label: string;
  path: string;
  exists: boolean;
}) {
  return (
    <div className="rounded-sm border border-border bg-surface-elevated px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="meta-label">{label}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${
            exists
              ? "border-status-success/20 bg-status-success-muted text-status-success"
              : "border-status-warning/30 bg-status-warning-muted text-status-warning"
          }`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          {exists ? "On disk" : "Missing"}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-muted" title={path}>
        {path || "—"}
      </p>
    </div>
  );
}