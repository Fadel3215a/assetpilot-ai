"use client";

import { useState } from "react";
import { reindexAllAssetsAction } from "@/lib/server/actions";
import { useProtectedAction } from "@/lib/client/permissions";
import { Button } from "./ui/button";

/**
 * Stage 4.2 — Rebuilds the hybrid search index for every asset.
 *
 * CURATOR/ADMIN-only via `useProtectedAction("CURATOR")`. On a locked (not
 * signed in / insufficient-role) session the shared login modal opens instead.
 * Reports the processed count + failures + wall-clock duration.
 */
export function ReindexButton() {
  const { locked, lockHint, guard } = useProtectedAction("CURATOR");
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleReindex() {
    if (running) return;
    if (!guard()) return;
    setRunning(true);
    setSummary(null);
    try {
      const res = await reindexAllAssetsAction();
      if (res.ok) {
        const failures = res.failed && res.failed > 0 ? `, ${res.failed} failed` : "";
        setSummary(`Re-indexed ${res.count} asset${res.count === 1 ? "" : "s"} in ${res.durationMs} ms${failures}.`);
      } else {
        setSummary(res.error ?? "Re-indexing failed.");
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="secondary"
        className="w-full justify-start px-3 py-2 text-xs"
        aria-disabled={locked || running}
        title={locked ? lockHint : undefined}
        onClick={() => void handleReindex()}
      >
        {running ? "Re-indexing…" : "Re-index vectors"}
      </Button>
      {summary && <p className="text-[11px] leading-relaxed text-muted">{summary}</p>}
    </div>
  );
}