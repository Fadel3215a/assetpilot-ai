"use client";

import { useEffect, useState } from "react";
import type { JobProgressPayload } from "@/types";

/**
 * Stage 1.3 — Real-time job progress hook.
 *
 * Subscribes to the `GET /api/jobs/[id]/progress` Server-Sent-Events endpoint
 * for a BullMQ job and exposes the latest `JobProgressPayload` plus a
 * connectivity flag. State is only written from SSE callbacks (never
 * synchronously inside the effect). Pass `null`/empty to hold the connection
 * closed.
 */
export interface UseJobProgressResult {
  /** Latest progress payload; `null` until the first event arrives. */
  payload: JobProgressPayload | null;
  /** True while the SSE connection is open. */
  connected: boolean;
}

export function useJobProgress(jobId?: string | null): UseJobProgressResult {
  const [payload, setPayload] = useState<JobProgressPayload | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    let source: EventSource;
    try {
      source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/progress`);
    } catch {
      return;
    }

    const onOpen = () => setConnected(true);
    const onProgress = (e: MessageEvent) => {
      try {
        setPayload(JSON.parse(e.data) as JobProgressPayload);
        setConnected(true);
      } catch {
        /* ignore malformed event */
      }
    };
    const onError = () => setConnected(false);

    source.addEventListener("open", onOpen);
    source.addEventListener("progress", onProgress);
    source.addEventListener("error", onError);

    return () => {
      source.removeEventListener("open", onOpen);
      source.removeEventListener("progress", onProgress);
      source.removeEventListener("error", onError);
      source.close();
    };
  }, [jobId]);

  return { payload, connected };
}
