import { Worker, type Job } from "bullmq";
import { getCollections } from "@/lib/server/queries";
import {
  addActivityRecord,
  applyCurationRules,
  generateAndAttachAnalysis,
  loadAssetForWorker,
  nowIso,
  recomputeProductionForWorker,
  writeSnapshot,
} from "@/lib/server/worker-orchestration";
import { QUEUE_NAMES } from "@/lib/queue/queues";
import { getWorkerConnection, isRedisConfigured } from "@/lib/queue/client";
import type { AIAnalysisJobData } from "@/types";

/**
 * Stage 1.2 — AI analysis worker.
 *
 * Performs the expensive, off-request Gemini multi-modal analysis for an asset:
 *   1. loads the asset + its AI session state,
 *   2. generates a fresh AIAnalysis (tags, observations, production verdict),
 *   3. recomputes curator quality scores + production readiness,
 *   4. evaluates the automated curation rules and, when they pass, promotes the
 *      asset to PRODUCTION_READY with an audit log entry.
 *
 * The full snapshot (persisted AIAnalysis + quality scores + status) is written
 * back to PostgreSQL in a single transaction.
 */

const DEFAULT_CONCURRENCY = 2;

const PROMOTION_ACTION = "Auto-promoted to production ready (curation rules)";

async function processAiAnalysis(job: Job<AIAnalysisJobData>): Promise<void> {
  const { assetId, versionId, targets } = job.data;

  const loaded = await loadAssetForWorker(assetId);
  if (!loaded) {
    throw new Error(`AI-analysis: asset ${assetId} not found`);
  }
  const { domain, aiSessionState: session } = loaded;

  job.log(`Analysis targets: ${targets.length ? targets.join(", ") : "all"}`);

  const collections = await getCollections();

  let updated = await generateAndAttachAnalysis(domain, collections);
  updated = recomputeProductionForWorker(updated);

  const { domain: promotedDomain, promoted } = applyCurationRules(updated, session);
  updated = promotedDomain;

  await writeSnapshot(updated);

  job.log(`Persisted AI analysis for asset ${assetId} (version ${versionId})`);

  if (promoted) {
    await addActivityRecord({
      assetId,
      assetName: updated.name,
      action: PROMOTION_ACTION,
      timestamp: nowIso(),
      source: "ai",
    });
    job.log(`Promoted ${assetId} to PRODUCTION_READY via curation rules`);
  }
}

export function createAiAnalysisWorker(): Worker<AIAnalysisJobData> | null {
  if (!isRedisConfigured()) {
    console.warn('[ai-analysis-worker] Redis is not configured; AI-analysis worker is disabled.');
    return null;
  }
  const worker = new Worker<AIAnalysisJobData>(
    QUEUE_NAMES.aiAnalysis,
    processAiAnalysis,
    {
      connection: getWorkerConnection(),
      concurrency: DEFAULT_CONCURRENCY,
    },
  );

  worker.on("ready", () => console.log(`[ai-analysis-worker] ready on "${QUEUE_NAMES.aiAnalysis}"`));
  worker.on("failed", (job, error) => {
    console.error(`[ai-analysis-worker] job ${job?.id} failed:`, error);
  });

  return worker;
}
