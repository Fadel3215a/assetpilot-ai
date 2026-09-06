import { EventEmitter } from "node:events";
import type { BackgroundJobState } from "@/types";

/**
 * Stage 5.1 — In-memory background job registry.
 *
 * The single source of truth for job lifecycle state when Redis is NOT
 * configured (the local-dev/fallback runner), and a lightweight metadata mirror
 * (id/type/createdAt) for jobs enqueued in production. Updates are broadcast
 * through a per-job EventEmitter so the SSE progress endpoint can stream live
 * events without polling.
 *
 * Held on `globalThis` so a single Next server process / dev-server HMR cycle
 * never resets it while route handlers and the in-process runner share it.
 */

interface MutableGlobal {
  assetpilotJobStore?: {
    jobs: Map<string, BackgroundJobState>;
    emitter: EventEmitter;
  };
}

const CHANNEL_PREFIX = "job:";

const globalFor = globalThis as unknown as MutableGlobal;

function store() {
  if (!globalFor.assetpilotJobStore) {
    globalFor.assetpilotJobStore = {
      jobs: new Map<string, BackgroundJobState>(),
      emitter: new EventEmitter(),
    };
  }
  return globalFor.assetpilotJobStore;
}

/** Monotonic-ish job id: `job-<base36 timestamp><base36 random suffix>`. */
export function generateJobId(): string {
  const stamp = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `job-${stamp}${suffix}`;
}

export const jobStore = {
  /** Records an initial job state or overwrites a live one. */
  upsert(state: BackgroundJobState): void {
    const current = store().jobs.get(state.id);
    const next = { ...current, ...state, updatedAt: Date.now() };
    store().jobs.set(state.id, next);
    store().emitter.emit(CHANNEL_PREFIX + state.id, next);
  },

  get(id: string): BackgroundJobState | null {
    return store().jobs.get(id) ?? null;
  },

  has(id: string): boolean {
    return store().jobs.has(id);
  },

  /** All live jobs, most recently updated first. */
  list(): BackgroundJobState[] {
    return [...store().jobs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /**
   * Subscribes to updates for one job. Returns an unsubscribe function. The
   * current state (if any) is NOT replayed — callers emit once themselves.
   */
  subscribe(id: string, listener: (state: BackgroundJobState) => void): () => void {
    const channel = CHANNEL_PREFIX + id;
    store().emitter.on(channel, listener);
    return () => {
      store().emitter.off(channel, listener);
    };
  },
};