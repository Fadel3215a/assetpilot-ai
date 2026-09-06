import { Queue } from "bullmq";
import {
  getQueueConnection,
  isRedisConfigured,
  MockRedisConnection,
} from "./client";
import type {
  AIAnalysisJobData,
  BackgroundJobData,
  IngestionJobData,
  RenditionJobData,
} from "@/types";

/**
 * Stage 1.1 — BullMQ queue registry.
 *
 * Central place that owns the background work queues:
 *   - ingestionQueue    : raw-file normalization + metadata extraction
 *   - aiAnalysisQueue   : Gemini analysis (tags, compact metadata, readiness)
 *   - renditionQueue    : derivative media (thumbnails/previews)
 *   - backgroundQueue   : Stage 5.1 dispatcher (EXPORT_ZIP, CONVERT_RENDITION,
 *                         REINDEX_VECTORS) — reused for any long-running work.
 *
 * Queue names are exported so workers and enqueuing callers stay in sync.
 *
 * When Redis is configured, each queue builds its own internal connection from
 * the shared options in client.ts. Without a configured Redis (build time, or
 * local dev without a broker) a mock is injected so the infrastructure can be
 * imported safely; no real jobs can flow until a live Redis is present.
 */

export const QUEUE_NAMES = {
  ingestion: "ingestion",
  aiAnalysis: "ai-analysis",
  rendition: "rendition",
  background: "background",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Namespaces all of a queue's Redis keys so they coexist with other keys. */
const QUEUE_PREFIX = "assetpilot";

function connection() {
  return isRedisConfigured()
    ? getQueueConnection()
    : (new MockRedisConnection() as unknown as ReturnType<typeof getQueueConnection>);
}

/**
 * Ingestion: raw file -> normalized, metadata-extracted asset.
 */
export const ingestionQueue = new Queue<IngestionJobData>(QUEUE_NAMES.ingestion, {
  prefix: QUEUE_PREFIX,
  connection: connection(),
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
});

/**
 * AI analysis: expensive Gemini generation run off the request path.
 */
export const aiAnalysisQueue = new Queue<AIAnalysisJobData>(QUEUE_NAMES.aiAnalysis, {
  prefix: QUEUE_PREFIX,
  connection: connection(),
});

/**
 * Renditions: derivative media generation from source files.
 */
export const renditionQueue = new Queue<RenditionJobData>(QUEUE_NAMES.rendition, {
  prefix: QUEUE_PREFIX,
  connection: connection(),
  defaultJobOptions: { attempts: 3, backoff: { type: "fixed", delay: 3000 } },
});

/**
 * Stage 5.1 — Unified dispatcher queue. Carries EXPORT_ZIP, CONVERT_RENDITION
 * and REINDEX_VECTORS jobs through the same worker; each job's `type` plus its
 * `jobId` (set when enqueued) drives both progress reporting and the POST/GET
 * routes.
 */
export const backgroundQueue = new Queue<BackgroundJobData>(QUEUE_NAMES.background, {
  prefix: QUEUE_PREFIX,
  connection: connection(),
  defaultJobOptions: { attempts: 2, backoff: { type: "exponential", delay: 2000 } },
});

/** Shuts down all registered queues' connections. Idempotent. */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    ingestionQueue.close(),
    aiAnalysisQueue.close(),
    renditionQueue.close(),
    backgroundQueue.close(),
  ]);
}
