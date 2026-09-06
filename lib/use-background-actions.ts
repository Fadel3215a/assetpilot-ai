"use client";

import { useCallback, useState } from "react";
import { useJobActivity } from "@/lib/job-activity-context";

/**
 * Stage 3.1 — Shared background-job dispatchers.
 *
 * Single home for the two user-facing job triggers (inventory ZIP export and
 * vector re-index) so CommandBar and the global hotkey engine dispatch the same
 * jobs with identical titles and job-activity tracking. A small busyAction
 * guard prevents double-dispatch while a job is being started.
 */

export interface DispatchResult {
  ok: boolean;
  jobId?: string;
  error?: string;
}

export function useBackgroundActions() {
  const { trackJob } = useJobActivity();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const dispatchExport = useCallback(
    async (assetIds: string[], collectionId?: string): Promise<DispatchResult> => {
      if (busyAction) return { ok: false, error: "A job is already being prepared." };
      setBusyAction("export");
      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json", "x-job-type": "EXPORT_ZIP" },
          body: JSON.stringify({
            ...(assetIds.length > 0 ? { assetIds: [...new Set(assetIds)] } : {}),
            ...(collectionId ? { collectionId } : {}),
          }),
        });
        if (!res.ok) {
          let message = "Export failed to start.";
          try {
            const payload = (await res.json()) as { error?: string };
            if (payload?.error) message = payload.error;
          } catch {
            // Non-JSON error body — keep the default message.
          }
          return { ok: false, error: message };
        }
        const payload = (await res.json()) as { ok: boolean; jobId?: string };
        if (!payload.jobId) return { ok: true };
        trackJob(
          payload.jobId,
          "EXPORT_ZIP",
          collectionId ? "Export collection ZIP" : "Export inventory ZIP",
        );
        return { ok: true, jobId: payload.jobId };
      } catch {
        return { ok: false, error: "Export failed to start." };
      } finally {
        setBusyAction(null);
      }
    },
    [busyAction, trackJob],
  );

  const dispatchReindex = useCallback(async (): Promise<DispatchResult> => {
    if (busyAction) return { ok: false, error: "A job is already being prepared." };
    setBusyAction("reindex");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-job-type": "REINDEX_VECTORS" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        let message = "Re-index failed to start.";
        try {
          const payload = (await res.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {
          // keep default
        }
        return { ok: false, error: message };
      }
      const payload = (await res.json()) as { ok: boolean; jobId?: string };
      if (payload.jobId) trackJob(payload.jobId, "REINDEX_VECTORS", "Re-index vectors");
      return { ok: true, jobId: payload.jobId };
    } catch {
      return { ok: false, error: "Re-index failed to start." };
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, trackJob]);

  return { busyAction, dispatchExport, dispatchReindex };
}