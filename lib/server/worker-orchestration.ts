import { prisma, withTransaction, type TxClient } from "@/lib/db";
import {
  activityToRow,
  assetColumns,
  historyToRow,
  versionToRow,
} from "@/lib/server/persist";
import { parseSessionState, toDomainAsset } from "@/lib/server/mappers";
import { calculateCuratorScore } from "@/lib/quality";
import { evaluateProductionCriteria } from "@/lib/production";
import { evaluateCurationRules, type CurationEvaluation } from "@/lib/curation-rules";
import { getAsyncAIAnalysisProvider } from "@/lib/server/ai-provider";
import type { Asset, AssetAISessionState, Collection } from "@/types";

/**
 * Stage 1.2 — Shared orchestration primitives for background workers.
 *
 * BullMQ workers run in a separate Node process from the Next server, so they
 * cannot import the `"use server"` action module (lib/server/actions.ts). These
 * functions replicate the exact snapshot/curation write semantics used by the
 * server actions, built from the same exported row mappers + transactional db
 * helpers, so worker-enqueued work produces identical results.
 */

function nowIso(): string {
  return new Date().toISOString();
}

function actId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Loads an asset's full domain model plus its parsed AI session state. */
export async function loadAssetForWorker(
  id: string,
): Promise<{ domain: Asset; aiSessionState: AssetAISessionState } | null> {
  const row = await prisma.asset.findUnique({
    where: { id },
    include: { versions: true, decisionHistory: true },
  });
  if (!row) return null;
  return {
    domain: toDomainAsset(row),
    aiSessionState: parseSessionState(row.aiSessionState),
  };
}

/**
 * Rewrites the asset snapshot (asset columns + versions + decision history)
 * exactly as the server actions' persistSnapshot does. Runs inside a single
 * interactive transaction.
 */
export async function writeSnapshot(domain: Asset): Promise<void> {
  await withTransaction(async (tx: TxClient) => await writeSnapshotTx(tx, domain));
}

export async function writeSnapshotTx(tx: TxClient, domain: Asset): Promise<void> {
  await tx.asset.update({ where: { id: domain.id }, data: assetColumns(domain) });
  await tx.assetVersion.deleteMany({ where: { assetId: domain.id } });
  if (domain.versions.length > 0) {
    await tx.assetVersion.createMany({
      data: domain.versions.map((v) => ({ ...versionToRow(v), assetId: domain.id })),
    });
  }
  await tx.decisionHistoryEntry.deleteMany({ where: { assetId: domain.id } });
  if (domain.decisionHistory.length > 0) {
    await tx.decisionHistoryEntry.createMany({
      data: domain.decisionHistory.map((entry) => ({
        ...historyToRow(entry),
        assetId: domain.id,
      })),
    });
  }
}

/** Writes an activity audit entry (model: ActivityItem). */
export async function addActivityRecord(item: {
  assetId: string;
  assetName: string;
  action: string;
  timestamp: string;
  source: "ai" | "curator";
}): Promise<void> {
  await prisma.activityItem.create({
    data: activityToRow({ ...item, id: actId() }),
  });
}

/**
 * Runs the automated curation rules and, when they pass and the asset is not
 * explicitly rejected / awaiting changes, flips the status to PRODUCTION_READY.
 * Returns whether a promotion occurred so callers can write an audit log.
 * Mutates the passed domain copy.
 */
export function applyCurationRules(
  domain: Asset,
  session: AssetAISessionState,
): { domain: Asset; evaluation: CurationEvaluation; promoted: boolean } {
  const evaluation = evaluateCurationRules(domain, session);
  const excluded = domain.status === "REJECTED" || domain.status === "CHANGES_REQUESTED";
  const promoted = evaluation.ready && !excluded && domain.status !== "PRODUCTION_READY";
  if (promoted) {
    domain.status = "PRODUCTION_READY";
    domain.updatedAt = nowIso();
  }
  return { domain, evaluation, promoted };
}

/**
 * Recomputes per-version curator quality scores and refreshes production
 * readiness (mirrors the server "use server" recomputeProduction helper).
 */
export function recomputeProductionForWorker(domain: Asset): Asset {
  const updated: Asset = {
    ...domain,
    versions: domain.versions.map((version) => {
      if (!version.curatorChecklist) return version;
      const curatorScore = calculateCuratorScore(version.curatorChecklist);
      return {
        ...version,
        curatorScore,
        qualityScore: { ...version.qualityScore, overall: curatorScore },
      };
    }),
  };

  const prod = evaluateProductionCriteria(updated);
  updated.productionReadiness = {
    score: prod.score,
    checklist: prod.items.map((i) => ({
      id: i.id,
      label: i.label,
      completed: i.completed,
    })),
    readyAt: prod.ready
      ? (updated.productionReadiness.readyAt ?? updated.updatedAt)
      : undefined,
  };
  return updated;
}

/**
 * Generates a fresh AI analysis for an asset and attaches it to the domain
 * model, then recomputes production readiness (mirrors the server "use server"
 * enrich helper). Does NOT persist — callers follow with writeSnapshot().
 */
export async function generateAndAttachAnalysis(
  domain: Asset,
  collections: Collection[],
): Promise<Asset> {
  const updated = { ...domain };
  const provider = await getAsyncAIAnalysisProvider();
  updated.aiAnalysis = await provider.analyze(updated, collections);
  const prod = evaluateProductionCriteria(updated);
  updated.productionReadiness = {
    score: prod.score,
    checklist: prod.items.map((i) => ({
      id: i.id,
      label: i.label,
      completed: i.completed,
    })),
    readyAt: prod.ready
      ? (updated.productionReadiness.readyAt ?? updated.updatedAt)
      : undefined,
  };
  return updated;
}

export { nowIso, actId };
