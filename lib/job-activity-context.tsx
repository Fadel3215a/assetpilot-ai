"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { BackgroundJobType, JobProgressPayload, JobStatus } from "@/types";

/**
 * Stage 2.2 — Global background-job activity tracker.
 *
 * The provider keeps a live list of "tracked" background jobs in an external
 * store (surviving client page transitions because JobActivityProvider lives in
 * AppShell, plus a sessionStorage backstop so hard reloads restore the ids).
 * Each tracked job gets a JobStreamer that subscribes to its SSE progress
 * endpoint and pushes payloads into the store, so the floating Job Activity
 * drawer can render progress bars, status tags, and the overall progress ring
 * for every in-flight task.
 *
 * State is only written from SSE callbacks / user handlers (never synchronously
 * in an effect body), which also keeps the React Compiler lint rules happy.
 */

export interface TrackedJob {
  jobId: string;
  type: BackgroundJobType;
  title: string;
  status: JobStatus;
  progressPercent: number;
  stepLabel: string;
  error?: string;
  /** Terminal result of a completed job (e.g. export ZIP metadata). */
  result?: unknown;
}

interface ActivityStore {
  getSnapshot: () => TrackedJob[];
  subscribe: (listener: () => void) => () => void;
  track: (jobId: string, type: BackgroundJobType, title: string) => void;
  apply: (jobId: string, payload: JobProgressPayload) => void;
  clearCompleted: () => void;
  restore: () => void;
}

const STORAGE_KEY = "assetpilot-job-activity";
const VALID_TYPES: ReadonlyArray<BackgroundJobType> = [
  "EXPORT_ZIP",
  "CONVERT_RENDITION",
  "REINDEX_VECTORS",
];

function isType(value: unknown): value is BackgroundJobType {
  return VALID_TYPES.includes(value as BackgroundJobType);
}

function createActivityStore(): ActivityStore {
  let jobs: TrackedJob[] = [];
  let snapshot: TrackedJob[] = [];
  const listeners = new Set<() => void>();
  let restored = false;

  const emit = () => {
    snapshot = jobs;
    for (const listener of listeners) listener();
  };

  const persist = () => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(jobs.map(({ jobId, type, title }) => ({ jobId, type, title }))),
      );
    } catch {
      // Storage unavailable (privacy mode, SSR) — non-fatal.
    }
  };

  const track = (jobId: string, type: BackgroundJobType, title: string) => {
    if (!jobId || jobs.some((job) => job.jobId === jobId)) return;
    jobs = [
      ...jobs,
      { jobId, type, title, status: "QUEUED", progressPercent: 0, stepLabel: "Queued" },
    ];
    persist();
    emit();
  };

  const apply = (jobId: string, payload: JobProgressPayload) => {
    if (!jobs.some((job) => job.jobId === jobId)) return;
    jobs = jobs.map((job) =>
      job.jobId === jobId
        ? {
            ...job,
            status: payload.status,
            progressPercent: payload.progressPercent,
            stepLabel: payload.stepLabel,
            ...(payload.error !== undefined ? { error: payload.error } : {}),
            ...(payload.result !== undefined ? { result: payload.result } : {}),
          }
        : job,
    );
    emit();
  };

  const clearCompleted = () => {
    const remaining = jobs.filter(
      (job) => job.status !== "COMPLETED" && job.status !== "FAILED",
    );
    if (remaining.length === jobs.length) return;
    jobs = remaining;
    persist();
    emit();
  };

  const restore = () => {
    if (restored) return;
    restored = true;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const stored: TrackedJob[] = [];
      for (const entry of parsed) {
        const item = entry as Partial<TrackedJob> | null;
        if (!item || typeof item.jobId !== "string" || typeof item.title !== "string") continue;
        if (!isType(item.type)) continue;
        stored.push({
          jobId: item.jobId,
          type: item.type,
          title: item.title,
          status: "QUEUED",
          progressPercent: 0,
          stepLabel: "Queued",
        });
      }
      if (stored.length > 0) {
        jobs = stored;
        emit();
      }
    } catch {
      // Corrupt/legacy payload — start fresh.
    }
  };

  return { getSnapshot: () => snapshot, subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, track, apply, clearCompleted, restore };
}

interface JobActivityContextValue {
  trackedJobs: TrackedJob[];
  trackJob: (jobId: string, type: BackgroundJobType, title: string) => void;
  clearCompleted: () => void;
}

const JobActivityContext = createContext<JobActivityContextValue | null>(null);

export function JobActivityProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => {
    const instance = createActivityStore();
    instance.restore();
    return instance;
  });

  const trackedJobs = useSyncExternalStore(store.subscribe, store.getSnapshot);

  const trackJob = useCallback(
    (jobId: string, type: BackgroundJobType, title: string) => store.track(jobId, type, title),
    [store],
  );
  const clearCompleted = useCallback(() => store.clearCompleted(), [store]);

  const value = useMemo<JobActivityContextValue>(
    () => ({ trackedJobs, trackJob, clearCompleted }),
    [trackedJobs, trackJob, clearCompleted],
  );

  return (
    <JobActivityContext.Provider value={value}>
      {children}
      {trackedJobs.map((job) => (
        <JobStreamer key={job.jobId} jobId={job.jobId} store={store} />
      ))}
    </JobActivityContext.Provider>
  );
}

/** Opens the SSE progress stream for a tracked job and pushes into the store. */
function JobStreamer({ jobId, store }: { jobId: string; store: ActivityStore }) {
  useEffect(() => {
    let source: EventSource;
    try {
      source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/progress`);
    } catch {
      return;
    }

    const onProgress = (event: MessageEvent) => {
      try {
        store.apply(jobId, JSON.parse(event.data) as JobProgressPayload);
      } catch {
        // Ignore malformed payloads.
      }
    };

    source.addEventListener("progress", onProgress);
    return () => {
      source.removeEventListener("progress", onProgress);
      source.close();
    };
  }, [jobId, store]);

  return null;
}

export function useJobActivity(): JobActivityContextValue {
  const context = useContext(JobActivityContext);
  if (!context) {
    throw new Error("useJobActivity must be used within a JobActivityProvider");
  }
  return context;
}