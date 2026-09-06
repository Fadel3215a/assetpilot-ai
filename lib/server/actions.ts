"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getAsyncAIAnalysisProvider,
} from "@/lib/server/ai-provider";
import { inferUploadCategory, mapCategoryToAssetType } from "@/lib/file-metadata";
import { prisma, withTransaction, type TxClient } from "@/lib/db";
import { buildNewVersion, buildUploadedAsset } from "@/lib/upload-asset";
import { calculateCuratorScore } from "@/lib/quality";
import { evaluateProductionCriteria } from "@/lib/production";
import {
  deriveRenditions,
  enrichExtractedFileMetadata,
  fileExtensionOf,
  type RenditionPaths,
} from "@/lib/renditions";
import { statusFromDecision } from "@/lib/utils";
import { indexAsset } from "@/lib/search";
import { evaluateCurationRules, type CurationEvaluation } from "@/lib/curation-rules";
import { buildExportZip } from "@/lib/export";
import { assertServerRole, AuthError } from "@/lib/auth";
import { isRedisConfigured } from "@/lib/queue/client";
import { ingestionQueue, QUEUE_NAMES } from "@/lib/queue/queues";
import { getStorageAdapter, isS3Configured } from "@/lib/storage/s3";
import {
  parseExtractedMetadata,
  parseSessionState,
  toDomainAsset,
  toDomainCollection,
} from "@/lib/server/mappers";
import {
  activityToRow,
  assetColumns,
  comparisonToRow,
  DEFAULT_SESSION_STATE,
  feedbackToRow,
  historyToRow,
  toJsonInput,
  versionToRow,
} from "@/lib/server/persist";
import { resetDemoData } from "@/lib/server/reset-demo";
import {
  getActivity,
  getAssetById,
  getAssets,
  getCollections as fetchCollections,
  getComparisons,
  getFeedbackEntries,
  getIgnoredDuplicateIds,
  hybridSearchAssets,
  reindexAllAssets,
} from "@/lib/server/queries";
import type {
  ActivityItem,
  Asset,
  AssetAISessionState,
  AssetSearchHit,
  AssetVersion,
  ChecklistRating,
  Collection,
  ComparisonDecisionType,
  ComparisonRecord,
  CuratorFeedbackEntry,
  ExtractedFileMetadata,
  QualityCriterion,
  ReviewDecisionType,
  UploadCategory,
} from "@/types";

const CURATOR = "Alex Chen";
const DEFAULT_UPLOAD_COLLECTION = "col-archive-draft";
const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

function nowIso(): string {
  return new Date().toISOString();
}

function actId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function loadCollections(): Promise<Collection[]> {
  const rows = await prisma.collection.findMany({ orderBy: { name: "asc" } });
  return rows.map(toDomainCollection);
}

async function loadAsset(
  tx: TxClient,
  id: string,
): Promise<{ domain: Asset; aiSessionState: AssetAISessionState } | null> {
  const row = await tx.asset.findUnique({
    where: { id },
    include: { versions: true, decisionHistory: true },
  });
  if (!row) return null;
  return {
    domain: toDomainAsset(row),
    aiSessionState: parseSessionState(row.aiSessionState),
  };
}

async function insertAssetWithChildren(tx: TxClient, domain: Asset): Promise<void> {
  await tx.asset.create({
    data: {
      ...assetColumns(domain),
      aiSessionState: toJsonInput(DEFAULT_SESSION_STATE),
      versions: { create: domain.versions.map((v) => versionToRow(v)) },
      decisionHistory: { create: domain.decisionHistory.map(historyToRow) },
    },
  });
}

async function persistSnapshot(tx: TxClient, a: Asset): Promise<void> {
  await tx.asset.update({ where: { id: a.id }, data: assetColumns(a) });
  await tx.assetVersion.deleteMany({ where: { assetId: a.id } });
  if (a.versions.length > 0) {
    await tx.assetVersion.createMany({ data: a.versions.map((v) => ({ ...versionToRow(v), assetId: a.id })) });
  }
  await tx.decisionHistoryEntry.deleteMany({ where: { assetId: a.id } });
  if (a.decisionHistory.length > 0) {
    await tx.decisionHistoryEntry.createMany({
      data: a.decisionHistory.map((entry) => ({ ...historyToRow(entry), assetId: a.id })),
    });
  }
}

async function updateSessionState(
  tx: TxClient,
  assetId: string,
  session: AssetAISessionState,
): Promise<void> {
  await tx.asset.update({
    where: { id: assetId },
    data: { aiSessionState: toJsonInput(session) },
  });
}

async function addActivity(
  tx: TxClient,
  item: { assetId: string; assetName: string; action: string; timestamp: string; source: "ai" | "curator" },
): Promise<void> {
  await tx.activityItem.create({
    data: {
      ...activityToRow({ ...item, id: actId() }),
    },
  });
}

async function addFeedback(
  tx: TxClient,
  entry: Omit<CuratorFeedbackEntry, "id" | "timestamp">,
): Promise<CuratorFeedbackEntry> {
  const full: CuratorFeedbackEntry = {
    ...entry,
    id: `fb-${Date.now()}`,
    timestamp: nowIso(),
  };
  await tx.curatorFeedbackEntry.create({ data: feedbackToRow(full) });
  return full;
}

async function enrich(domain: Asset, collections: Collection[]): Promise<Asset> {
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

/**
 * Recomputes curator quality scores and production readiness for an asset,
 * returning a copy with updated version qualityScore/curatorScore and a fresh
 * productionReadiness. Tags/metadata changes (or explicit re-evaluation) can
 * move assets in/out of the production-ready set, so HITL decisions and bulk
 * operations must call this before persisting the snapshot.
 */
function recomputeProduction(domain: Asset): Asset {
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
 * Stage 4.2 — Automated curation rules gate.
 *
 * Evaluates the asset against the automated rules (quality > 85, zero unresolved
 * observations, mandatory checklist cleared). When all rules pass and the asset
 * is not explicitly rejected / awaiting changes, it is auto-promoted to
 * PRODUCTION_READY. Returns whether a promotion occurred (and the evaluation)
 * so callers can log an activity entry.
 *
 * Mutates the passed-in copy (callers own the object), consistent with the rest
 * of the action helpers.
 */
function runCurationRules(
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

function uniqueConcat(existing: string[], next: string[]): string[] {
  return Array.from(new Set([...existing, ...next]));
}

function reviewActionLabel(action: ReviewAction): string {
  switch (action) {
    case "APPROVED":
      return "Approved by curator";
    case "REJECTED":
      return "Rejected by curator";
    case "CHANGES_REQUESTED":
      return "Changes requested";
  }
}

type ReviewAction = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^A-Za-z0-9._-]/g, "_");
}

function mediaUrlFor(versionId: string, fileName: string): string {
  return `/media/${versionId}-${sanitizeFileName(fileName)}`;
}

async function persistUploadBytes(
  storedName: string,
  bytes: Buffer,
): Promise<void> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(path.join(STORAGE_ROOT, storedName), bytes);
}

/**
 * Deletes the media files owned exclusively by a version. Uploaded originals are
 * stored under STORAGE_ROOT as `{versionId}-{sanitizedFileName}`, so only files
 * whose basename begins with the version id are ever removed. Shared per-asset
 * rendition files (storage/uploads/renditions/...) are never touched because
 * other versions may still reference them.
 */
async function removeVersionMedia(version: AssetVersion): Promise<void> {
  const candidates = [version.mediaUrl, version.previewPath, version.thumbnailPath];
  const targets = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || !candidate.startsWith("/media/")) continue;
    const relative = candidate.slice("/media/".length);
    if (relative.split(/[\\/]/).includes("renditions")) continue;

    const absolute = path.resolve(STORAGE_ROOT, relative);
    const storagePrefix = STORAGE_ROOT.endsWith(path.sep)
      ? STORAGE_ROOT
      : `${STORAGE_ROOT}${path.sep}`;
    if (!absolute.startsWith(storagePrefix)) continue;

    const basename = path.basename(absolute);
    if (!basename.startsWith(`${version.id}-`)) continue;
    targets.add(absolute);
  }

  await Promise.all([...targets].map((target) => unlink(target).catch(() => {})));
}

function nextVersionIdOf(asset: Asset): string {
  const nextNumber = Math.max(...asset.versions.map((v) => v.versionNumber)) + 1;
  return `ver-${asset.id}-${nextNumber}`;
}

/**
 * Points the current version's display variants at freshly derived thumbnail
 * and web-preview URIs. Returns the asset unchanged when no renditions were
 * produced (non-images, decode failures) so the raw upload paths remain set.
 */
function attachRenditions(asset: Asset, renditions: RenditionPaths | null): Asset {
  if (!renditions) return asset;
  return {
    ...asset,
    versions: asset.versions.map((v) =>
      v.isCurrent
        ? {
            ...v,
            thumbnailPath: renditions.thumbnailPath,
            previewPath: renditions.previewPath,
          }
        : v,
    ),
  };
}

export async function submitReviewAction(
  assetId: string,
  payload: { action: ReviewAction; notes?: string; checklist: QualityCriterion[] },
): Promise<{ ok: boolean; error?: string; asset?: Asset }> {
  const { action, notes, checklist } = payload;

  if (
    (action === "REJECTED" || action === "CHANGES_REQUESTED") &&
    (!notes || notes.trim().length === 0)
  ) {
    return { ok: false, error: "Please provide curator notes explaining this decision." };
  }

  try {
    await assertServerRole("CURATOR");
    const asset = await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) throw new Error("ASSET_NOT_FOUND");

      const domain = loaded.domain;
      const timestamp = nowIso();
      const previousStatus = domain.status;
      const newStatus = statusFromDecision(action);
      const curatorScore = calculateCuratorScore(checklist);

      const historyEntry = {
        id: `dh-${Date.now()}`,
        assetId,
        timestamp,
        reviewer: CURATOR,
        previousStatus,
        newStatus,
        decision: action as ReviewDecisionType,
        reason: notes,
        curatorScore,
      };

      domain.decisionHistory = [historyEntry, ...domain.decisionHistory];
      domain.status = newStatus;
      domain.updatedAt = timestamp;

      domain.versions = domain.versions.map((version) => {
        if (!version.isCurrent) return version;
        return {
          ...version,
          curatorChecklist: checklist,
          curatorScore,
          qualityScore: { ...version.qualityScore, overall: curatorScore },
          reviewDecision: {
            type: action as ReviewDecisionType,
            reviewer: CURATOR,
            decidedAt: timestamp,
            notes,
          },
          metadata: { ...version.metadata, updatedAt: timestamp },
        };
      });

      const prod = evaluateProductionCriteria(domain);
      domain.productionReadiness = {
        score: prod.score,
        checklist: prod.items.map((i) => ({
          id: i.id,
          label: i.label,
          completed: i.completed,
        })),
        readyAt: prod.ready ? timestamp : undefined,
      };

      // Automated curation rules gate: on an APPROVED review, promote only when
      // the objective rules (quality > 85, no unresolved observations, mandatory
      // checklist cleared) all pass. This is stricter than generic readiness.
      let curationPromoted = false;
      if (action === "APPROVED") {
        const result = runCurationRules(domain, loaded.aiSessionState);
        curationPromoted = result.promoted;
        if (curationPromoted) {
          domain.productionReadiness = {
            ...domain.productionReadiness,
            readyAt: timestamp,
          };
        }
      }

      await persistSnapshot(tx, domain);
      await addActivity(tx, {
        assetId,
        assetName: domain.name,
        action: reviewActionLabel(action),
        timestamp,
        source: "curator",
      });
      if (curationPromoted) {
        await addActivity(tx, {
          assetId,
          assetName: domain.name,
          action: "Auto-promoted to production ready (curation rules)",
          timestamp,
          source: "curator",
        });
      }

      return domain;
    });

    return { ok: true, asset };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === "ASSET_NOT_FOUND") {
      return { ok: false, error: "Asset not found." };
    }
    console.error("submitReviewAction failed", error);
    return { ok: false, error: "Could not save this review. Please try again." };
  }
}

export async function submitComparisonAction(payload: {
  itemA: { assetId: string; versionId: string; label: string };
  itemB: { assetId: string; versionId: string; label: string };
  decision: ComparisonDecisionType;
  reason: string;
}): Promise<{ ok: boolean; error?: string; record?: ComparisonRecord; assets?: Asset[] }> {
  if (!payload.reason.trim()) {
    return { ok: false, error: "Please provide a reason for this comparison decision." };
  }

  try {
    await assertServerRole("CURATOR");
    const result = await withTransaction(async (tx) => {
      const timestamp = nowIso();
      const affected: Asset[] = [];

      const applyStatus = async (assetId: string, status: "APPROVED" | "REJECTED") => {
        const row = await tx.asset.findUnique({ where: { id: assetId } });
        if (!row) return;
        await tx.asset.update({
          where: { id: assetId },
          data: { status, updatedAt: new Date(timestamp) },
        });
      };

      const reloadDomain = async (assetId: string): Promise<Asset | null> => {
        const loaded = await loadAsset(tx, assetId);
        return loaded?.domain ?? null;
      };

      if (payload.decision === "PREFER_A" || payload.decision === "PREFER_B") {
        const preferredId =
          payload.decision === "PREFER_A" ? payload.itemA.assetId : payload.itemB.assetId;
        const rejectedId =
          payload.decision === "PREFER_A" ? payload.itemB.assetId : payload.itemA.assetId;

        await applyStatus(preferredId, "APPROVED");
        await applyStatus(rejectedId, "REJECTED");
      } else if (payload.decision === "REJECT_BOTH") {
        await applyStatus(payload.itemA.assetId, "REJECTED");
        await applyStatus(payload.itemB.assetId, "REJECTED");
      }

      for (const id of [payload.itemA.assetId, payload.itemB.assetId]) {
        const domain = await reloadDomain(id);
        if (domain) affected.push(domain);
      }

      const record: ComparisonRecord = {
        id: `cmp-${Date.now()}`,
        timestamp,
        reviewer: CURATOR,
        itemA: payload.itemA,
        itemB: payload.itemB,
        decision: payload.decision,
        reason: payload.reason,
      };
      await tx.comparisonRecord.create({ data: comparisonToRow(record) });

      await addActivity(tx, {
        assetId: payload.itemA.assetId,
        assetName: payload.itemA.label,
        action: `Curator comparison: ${payload.decision.replace(/_/g, " ").toLowerCase()}`,
        timestamp,
        source: "curator",
      });

      return { record, assets: affected };
    });

    return { ok: true, record: result.record, assets: result.assets };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("submitComparisonAction failed", error);
    return { ok: false, error: "Could not save this comparison. Please try again." };
  }
}

export async function updateCuratorChecklistAction(
  assetId: string,
  criterionId: string,
  rating: ChecklistRating,
): Promise<{ ok: boolean; error?: string; asset?: Asset }> {
  if (!["PASS", "NEEDS_REVIEW", "FAIL"].includes(rating)) {
    return { ok: false, error: "Invalid checklist rating." };
  }

  try {
    await assertServerRole("CURATOR");
    const asset = await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) throw new Error("ASSET_NOT_FOUND");
      const domain = loaded.domain;

      domain.versions = domain.versions.map((version) => {
        if (!version.isCurrent || !version.curatorChecklist) return version;
        const checklist = version.curatorChecklist.map((c) =>
          c.id === criterionId ? { ...c, rating } : c,
        );
        const curatorScore = calculateCuratorScore(checklist);
        return {
          ...version,
          curatorChecklist: checklist,
          curatorScore,
          qualityScore: { ...version.qualityScore, overall: curatorScore },
        };
      });

      const prod = evaluateProductionCriteria(domain);
      domain.productionReadiness = {
        score: prod.score,
        checklist: prod.items.map((i) => ({
          id: i.id,
          label: i.label,
          completed: i.completed,
        })),
        readyAt: prod.ready ? domain.productionReadiness.readyAt : undefined,
      };
      await persistSnapshot(tx, domain);
      return domain;
    });

    return { ok: true, asset };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === "ASSET_NOT_FOUND") {
      return { ok: false, error: "Asset not found." };
    }
    console.error("updateCuratorChecklistAction failed", error);
    return { ok: false, error: "Could not update the checklist. Please try again." };
  }
}

export async function acceptTagSuggestionAction(
  assetId: string,
  tagId: string,
): Promise<{ ok: boolean; error?: string; asset?: Asset; feedback?: CuratorFeedbackEntry }> {
  try {
    await assertServerRole("CURATOR");
    return await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) return { ok: false, error: "Asset not found." };
      const { domain: initialDomain, aiSessionState } = loaded;
      let domain = initialDomain;

      const suggestion = domain.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return { ok: false, error: "Suggestion not found." };

      if (!domain.tags.includes(suggestion.tag)) {
        domain.tags = [...domain.tags, suggestion.tag];
      }

      domain = recomputeProduction(domain);

      const session: AssetAISessionState = {
        ...aiSessionState,
        acceptedTagIds: uniqueConcat(aiSessionState.acceptedTagIds, [tagId]),
        dismissedTagIds: uniqueConcat(aiSessionState.dismissedTagIds, [tagId]),
      };

      await persistSnapshot(tx, domain);
      await updateSessionState(tx, assetId, session);

      const feedback = await addFeedback(tx, {
        assetId,
        suggestionType: "tag",
        suggestion: suggestion.tag,
        curatorAction: "accepted",
        finalValue: suggestion.tag,
      });

      await addActivity(tx, {
        assetId,
        assetName: domain.name,
        action: `Curator accepted tag: "${suggestion.tag}"`,
        timestamp: nowIso(),
        source: "curator",
      });

      return { ok: true, asset: domain, feedback };
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("acceptTagSuggestionAction failed", error);
    return { ok: false, error: "Could not accept this tag. Please try again." };
  }
}

export async function editTagSuggestionAction(
  assetId: string,
  tagId: string,
  newTag: string,
): Promise<{ ok: boolean; error?: string; asset?: Asset; feedback?: CuratorFeedbackEntry }> {
  const trimmed = newTag.trim();
  if (!trimmed) return { ok: false, error: "Tag cannot be empty." };

  try {
    await assertServerRole("CURATOR");
    return await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) return { ok: false, error: "Asset not found." };
      const { domain: initialDomain, aiSessionState } = loaded;
      let domain = initialDomain;

      const suggestion = domain.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return { ok: false, error: "Suggestion not found." };

      if (!domain.tags.includes(trimmed)) {
        domain.tags = [...domain.tags, trimmed];
      }

      domain = recomputeProduction(domain);

      const session: AssetAISessionState = {
        ...aiSessionState,
        acceptedTagIds: uniqueConcat(aiSessionState.acceptedTagIds, [tagId]),
        dismissedTagIds: uniqueConcat(aiSessionState.dismissedTagIds, [tagId]),
      };

      await persistSnapshot(tx, domain);
      await updateSessionState(tx, assetId, session);

      const feedback = await addFeedback(tx, {
        assetId,
        suggestionType: "tag",
        suggestion: suggestion.tag,
        curatorAction: "edited",
        finalValue: trimmed,
      });

      await addActivity(tx, {
        assetId,
        assetName: domain.name,
        action: `Curator edited tag: "${suggestion.tag}" â†’ "${trimmed}"`,
        timestamp: nowIso(),
        source: "curator",
      });

      return { ok: true, asset: domain, feedback };
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("editTagSuggestionAction failed", error);
    return { ok: false, error: "Could not edit this tag. Please try again." };
  }
}

export async function dismissTagSuggestionAction(
  assetId: string,
  tagId: string,
): Promise<{ ok: boolean; error?: string; feedback?: CuratorFeedbackEntry }> {
  try {
    await assertServerRole("CURATOR");
    return await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) return { ok: false, error: "Asset not found." };
      const { domain: initialDomain, aiSessionState } = loaded;
      let domain = initialDomain;

      const suggestion = domain.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return { ok: false, error: "Suggestion not found." };

      const session: AssetAISessionState = {
        ...aiSessionState,
        dismissedTagIds: uniqueConcat(aiSessionState.dismissedTagIds, [tagId]),
      };

      domain = recomputeProduction(domain);
      await persistSnapshot(tx, domain);
      await updateSessionState(tx, assetId, session);

      const feedback = await addFeedback(tx, {
        assetId,
        suggestionType: "tag",
        suggestion: suggestion.tag,
        curatorAction: "dismissed",
      });

      await addActivity(tx, {
        assetId,
        assetName: domain.name,
        action: `Curator dismissed tag: "${suggestion.tag}"`,
        timestamp: nowIso(),
        source: "curator",
      });

      return { ok: true, feedback };
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("dismissTagSuggestionAction failed", error);
    return { ok: false, error: "Could not dismiss this tag. Please try again." };
  }
}

export async function acceptCollectionSuggestionAction(
  assetId: string,
  collectionId: string,
): Promise<{ ok: boolean; error?: string; asset?: Asset; feedback?: CuratorFeedbackEntry }> {
  try {
    await assertServerRole("CURATOR");
    return await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) return { ok: false, error: "Asset not found." };
      const { domain: initialDomain, aiSessionState } = loaded;
      let domain = initialDomain;

      const collectionRow = await tx.collection.findUnique({ where: { id: collectionId } });
      if (!collectionRow) return { ok: false, error: "Collection not found." };

      domain.collectionId = collectionId;
      domain = recomputeProduction(domain);
      await persistSnapshot(tx, domain);

      const session: AssetAISessionState = {
        ...aiSessionState,
        collectionOverrides: uniqueConcat(aiSessionState.collectionOverrides, [collectionId]),
      };
      await updateSessionState(tx, assetId, session);

      const feedback = await addFeedback(tx, {
        assetId,
        suggestionType: "collection",
        suggestion: domain.aiAnalysis.suggestedCollectionId,
        curatorAction: "accepted",
        finalValue: collectionId,
      });

      await addActivity(tx, {
        assetId,
        assetName: domain.name,
        action: `Curator accepted collection: "${collectionRow.name}"`,
        timestamp: nowIso(),
        source: "curator",
      });

      return { ok: true, asset: domain, feedback };
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("acceptCollectionSuggestionAction failed", error);
    return { ok: false, error: "Could not accept this collection. Please try again." };
  }
}

export async function acceptObservationAction(
  assetId: string,
  observationId: string,
): Promise<{ ok: boolean; error?: string; feedback?: CuratorFeedbackEntry }> {
  try {
    await assertServerRole("CURATOR");
    return await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) return { ok: false, error: "Asset not found." };
      const { domain: initialDomain, aiSessionState } = loaded;
      let domain = initialDomain;

      const obs = domain.aiAnalysis.observations.find((o) => o.id === observationId);
      if (!obs) return { ok: false, error: "Observation not found." };

      const session: AssetAISessionState = {
        ...aiSessionState,
        acceptedObservationIds: uniqueConcat(aiSessionState.acceptedObservationIds, [observationId]),
        dismissedObservationIds: uniqueConcat(
          aiSessionState.dismissedObservationIds,
          [observationId],
        ),
      };

      domain = recomputeProduction(domain);
      await persistSnapshot(tx, domain);
      await updateSessionState(tx, assetId, session);

      const feedback = await addFeedback(tx, {
        assetId,
        suggestionType: "observation",
        suggestion: obs.text,
        curatorAction: "accepted",
        finalValue: obs.text,
      });

      await addActivity(tx, {
        assetId,
        assetName: domain.name,
        action: `Curator accepted observation: "${obs.text}"`,
        timestamp: nowIso(),
        source: "curator",
      });

      return { ok: true, feedback };
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("acceptObservationAction failed", error);
    return { ok: false, error: "Could not accept this observation. Please try again." };
  }
}

export async function dismissObservationAction(
  assetId: string,
  observationId: string,
): Promise<{ ok: boolean; error?: string; feedback?: CuratorFeedbackEntry }> {
  try {
    await assertServerRole("CURATOR");
    return await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) return { ok: false, error: "Asset not found." };
      const { domain: initialDomain, aiSessionState } = loaded;
      let domain = initialDomain;

      const obs = domain.aiAnalysis.observations.find((o) => o.id === observationId);
      if (!obs) return { ok: false, error: "Observation not found." };

      const session: AssetAISessionState = {
        ...aiSessionState,
        dismissedObservationIds: uniqueConcat(
          aiSessionState.dismissedObservationIds,
          [observationId],
        ),
      };

      domain = recomputeProduction(domain);
      await persistSnapshot(tx, domain);
      await updateSessionState(tx, assetId, session);

      const feedback = await addFeedback(tx, {
        assetId,
        suggestionType: "observation",
        suggestion: obs.text,
        curatorAction: "dismissed",
      });

      await addActivity(tx, {
        assetId,
        assetName: domain.name,
        action: `Curator dismissed observation: "${obs.text}"`,
        timestamp: nowIso(),
        source: "curator",
      });

      return { ok: true, feedback };
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("dismissObservationAction failed", error);
    return { ok: false, error: "Could not dismiss this observation. Please try again." };
  }
}

export async function markAIAssistedReviewAction(
  assetId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertServerRole("CURATOR");
    await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) throw new Error("ASSET_NOT_FOUND");
      const session: AssetAISessionState = {
        ...loaded.aiSessionState,
        aiAssistedReview: true,
      };
      await updateSessionState(tx, assetId, session);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "ASSET_NOT_FOUND") {
      return { ok: false, error: "Asset not found." };
    }
    console.error("markAIAssistedReviewAction failed", error);
    return { ok: false, error: "Could not record AI-assisted review. Please try again." };
  }
}

export async function uploadAssetAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  assetId?: string;
  asset?: Asset;
}> {
  try {
    await assertServerRole("CURATOR");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Could not process uploaded file." };
    }

    const collectionId =
      (formData.get("collectionId") as string | null)?.trim() || DEFAULT_UPLOAD_COLLECTION;

    const extractedRaw = formData.get("extractedMetadata");
    if (typeof extractedRaw !== "string") {
      return { ok: false, error: "Could not process uploaded file." };
    }
    const extracted = parseExtractedMetadata(JSON.parse(extractedRaw));

    const collections = await loadCollections();
    if (!collections.some((c) => c.id === collectionId)) {
      return { ok: false, error: "Collection not found." };
    }

    const category = inferUploadCategory(file);
    const type = mapCategoryToAssetType(category);
    const assetId = `asset-upload-${Date.now()}`;
    const versionId = `ver-${assetId}-1`;
    const storedName = `${versionId}-${sanitizeFileName(file.name)}`;
    const mediaPath = mediaUrlFor(versionId, file.name);
    const extension = fileExtensionOf(file.name);

    const fileBytes = Buffer.from(await file.arrayBuffer());
    const enriched = await enrichExtractedFileMetadata(extracted, fileBytes, extension);

    let domain = buildUploadedAsset(enriched, type, mediaPath, collectionId, collections, {
      isSessionUpload: false,
      id: assetId,
    });
    domain = attachRenditions(domain, await deriveRenditions(fileBytes, assetId, extension));

    await persistUploadBytes(storedName, fileBytes);

    domain = await withTransaction(async (tx) => {
      await insertAssetWithChildren(tx, domain);

      await addActivity(tx, {
        assetId: domain.id,
        assetName: domain.name,
        action: "Asset uploaded",
        timestamp: nowIso(),
        source: "curator",
      });
      await addActivity(tx, {
        assetId: domain.id,
        assetName: domain.name,
        action: "AI analysis generated for uploaded asset",
        timestamp: nowIso(),
        source: "ai",
      });
      return domain;
    });

    // Keep the hybrid search index in sync with the new asset.
    const uploadCollection = collections.find((c) => c.id === domain.collectionId);
    await indexAsset(domain, uploadCollection?.name);

    return { ok: true, assetId: domain.id, asset: domain };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("uploadAssetAction failed", error);
    return { ok: false, error: "Could not process uploaded file." };
  }
}

function uploadCategoryOf(fileName: string, contentType: string): UploadCategory {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["glb", "gltf", "obj", "fbx", "usdz"].includes(ext ?? "")) return "3d";
  return "other";
}

/**
 * Stage 2.2 — Registers an asset that was uploaded directly to storage.
 *
 * Called by the client upload manager after the object bytes are in place
 * (either via a presigned PUT to S3/R2, or — on the local backend — bundled
 * with this call). Persists the asset record, then enqueues the background
 * ingestion job so normalization and AI analysis happen off the upload path.
 */
export async function registerDirectUploadAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  assetId?: string;
  asset?: Asset;
}> {
  try {
    await assertServerRole("CURATOR");

    const file = formData.get("file");
    const assetId = (formData.get("assetId") as string | null)?.trim();
    const key = (formData.get("key") as string | null)?.trim();
    const fileName = (formData.get("fileName") as string | null)?.trim();
    const contentType =
      ((formData.get("contentType") as string | null)?.trim() || "application/octet-stream");
    const size = Number(formData.get("size") ?? 0);
    const collectionId =
      (formData.get("collectionId") as string | null)?.trim() || DEFAULT_UPLOAD_COLLECTION;

    if (!assetId || !key || !fileName) {
      return { ok: false, error: "Could not process uploaded file." };
    }

    const extractedRaw = formData.get("extractedMetadata");
    let extracted: ExtractedFileMetadata;
    if (typeof extractedRaw === "string") {
      try {
        extracted = parseExtractedMetadata(JSON.parse(extractedRaw));
      } catch {
        return { ok: false, error: "Could not process uploaded file." };
      }
    } else {
      extracted = parseExtractedMetadata({
        fileName,
        extension: fileExtensionOf(fileName),
        mimeType: contentType,
        fileSize: size,
      });
    }

    // Local fallback: the source bytes ride along with this call and are
    // persisted through the storage adapter. S3/R2 uploads happen via the
    // presigned PUT and never reach this action.
    if (file instanceof File) {
      const fileBytes = Buffer.from(await file.arrayBuffer());
      await getStorageAdapter().putObject(key, fileBytes, contentType);
    }

    const collections = await loadCollections();
    if (!collections.some((c) => c.id === collectionId)) {
      return { ok: false, error: "Collection not found." };
    }

    const type = mapCategoryToAssetType(uploadCategoryOf(fileName, contentType));

    const domain = buildUploadedAsset(extracted, type, `/media/${key}`, collectionId, collections, {
      isSessionUpload: false,
      id: assetId,
    });

    await withTransaction(async (tx) => {
      await insertAssetWithChildren(tx, domain);
      await addActivity(tx, {
        assetId: domain.id,
        assetName: domain.name,
        action: "Asset uploaded",
        timestamp: nowIso(),
        source: "curator",
      });
      await addActivity(tx, {
        assetId: domain.id,
        assetName: domain.name,
        action: "AI analysis queued for uploaded asset",
        timestamp: nowIso(),
        source: "ai",
      });
    });

    // Keep the hybrid search index in sync with the new asset.
    const uploadCollection = collections.find((c) => c.id === domain.collectionId);
    await indexAsset(domain, uploadCollection?.name);

    // Enqueue background ingestion. Real jobs need a live Redis; without one
    // this is a no-op (the environment already surfaced in logs/server state).
    if (isRedisConfigured()) {
      // S3-backed objects have no local path yet; the key is handed to the
      // worker as its filePath until a storage-aware worker reads it directly.
      const filePath = isS3Configured() ? key : path.join(STORAGE_ROOT, key);
      // The BullMQ job id matches the asset id so the job-progress SSE gateway
      // (tracked by asset id from the client) can locate the job directly.
      await ingestionQueue.add(
        QUEUE_NAMES.ingestion,
        { assetId, filePath, mimeType: contentType, collectionId },
        { jobId: assetId, removeOnComplete: 100, removeOnFail: 500 },
      );
    }

    return { ok: true, assetId: domain.id, asset: domain };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("registerDirectUploadAction failed", error);
    return { ok: false, error: "Could not process uploaded file." };
  }
}

export async function updateAssetMetadataAction(
  assetId: string,
  payload: { name: string; description: string; tags: string[]; collectionId: string; usageNotes: string },
): Promise<{ ok: boolean; error?: string; asset?: Asset }> {
  try {
    await assertServerRole("CURATOR");
    const asset = await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) throw new Error("ASSET_NOT_FOUND");
      let domain = loaded.domain;

      const collections = await loadCollectionsTx(tx);
      if (!collections.some((c) => c.id === payload.collectionId)) {
        throw new Error("COLLECTION_NOT_FOUND");
      }

      const timestamp = nowIso();
      domain = {
        ...domain,
        name: payload.name,
        tags: [...payload.tags],
        collectionId: payload.collectionId,
        usageNotes: payload.usageNotes,
        updatedAt: timestamp,
        versions: domain.versions.map((v) =>
          v.isCurrent
            ? {
                ...v,
                metadata: {
                  ...v.metadata,
                  title: payload.name,
                  description: payload.description,
                  updatedAt: timestamp,
                },
              }
            : v,
        ),
      };

      domain = await enrich(domain, collections);

      // Automated curation rules gate: an edit that satisfies the objective
      // rules (quality > 85, no unresolved observations, mandatory checklist
      // cleared) can auto-promote an otherwise-eligible asset.
      let curationPromoted = false;
      {
        const result = runCurationRules(domain, loaded.aiSessionState);
        curationPromoted = result.promoted;
      }

      await persistSnapshot(tx, domain);

      await addActivity(tx, {
        assetId,
        assetName: payload.name,
        action: "Metadata updated",
        timestamp,
        source: "curator",
      });
      if (curationPromoted) {
        await addActivity(tx, {
          assetId,
          assetName: payload.name,
          action: "Auto-promoted to production ready (curation rules)",
          timestamp,
          source: "curator",
        });
      }

      return domain;
    });

    return { ok: true, asset };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof Error) {
      if (error.message === "ASSET_NOT_FOUND") return { ok: false, error: "Asset not found." };
      if (error.message === "COLLECTION_NOT_FOUND") {
        return { ok: false, error: "Collection not found." };
      }
    }
    console.error("updateAssetMetadataAction failed", error);
    return { ok: false, error: "Could not update metadata. Please try again." };
  }
}

async function loadCollectionsTx(tx: TxClient): Promise<Collection[]> {
  const rows = await tx.collection.findMany({ orderBy: { name: "asc" } });
  return rows.map(toDomainCollection);
}

export async function createAssetVersionAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  asset?: Asset;
}> {
  try {
    await assertServerRole("CURATOR");
    const assetId = formData.get("assetId");
    const label = formData.get("label");
    if (typeof assetId !== "string" || typeof label !== "string" || !label.trim()) {
      return { ok: false, error: "Could not create version." };
    }

    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    const extractedRaw = formData.get("extractedMetadata");
    const hasExtracted = typeof extractedRaw === "string" && extractedRaw.length > 0;

    if (hasFile !== hasExtracted) {
      return { ok: false, error: "Could not create version." };
    }

    const extracted = hasExtracted
      ? parseExtractedMetadata(JSON.parse(extractedRaw as string))
      : null;

    let resultAsset: Asset | undefined;
    let versionCollections: Collection[] = [];
    await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) throw new Error("ASSET_NOT_FOUND");
      const collections = await loadCollectionsTx(tx);
      versionCollections = collections;

      let objectUrl: string | null = null;
      let updated: Asset;
      if (hasFile && extracted && file instanceof File) {
        const versionId = nextVersionIdOf(loaded.domain);
        const storedName = `${versionId}-${sanitizeFileName(file.name)}`;
        objectUrl = mediaUrlFor(versionId, file.name);

        const fileBytes = Buffer.from(await file.arrayBuffer());
        const extension = fileExtensionOf(file.name);
        const enriched = await enrichExtractedFileMetadata(extracted, fileBytes, extension);

        updated = buildNewVersion(loaded.domain, objectUrl, enriched, label);
        updated = attachRenditions(updated, await deriveRenditions(fileBytes, assetId, extension));

        await persistUploadBytes(storedName, fileBytes);
      } else {
        updated = buildNewVersion(loaded.domain, objectUrl, extracted, label);
      }
      updated = await enrich(updated, collections);

      await persistSnapshot(tx, updated);
      await addActivity(tx, {
        assetId,
        assetName: updated.name,
        action: `Version created: ${label}`,
        timestamp: nowIso(),
        source: "curator",
      });
      resultAsset = updated;
    });

    // The current version's metadata feeds the hybrid search index, so refresh
    // it whenever a new version is created.
    if (resultAsset) {
      const versionCollection = versionCollections.find(
        (c) => c.id === resultAsset?.collectionId,
      );
      await indexAsset(resultAsset, versionCollection?.name);
    }

    return { ok: true, asset: resultAsset };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === "ASSET_NOT_FOUND") {
      return { ok: false, error: "Asset not found." };
    }
    console.error("createAssetVersionAction failed", error);
    return { ok: false, error: "Could not create version." };
  }
}

export async function promoteVersionAction(
  assetId: string,
  versionId: string,
): Promise<{ ok: boolean; error?: string; asset?: Asset }> {
  try {
    await assertServerRole("CURATOR");
    const asset = await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) throw new Error("ASSET_NOT_FOUND");

      const domain = loaded.domain;
      const version = domain.versions.find((v) => v.id === versionId);
      if (!version) throw new Error("VERSION_NOT_FOUND");
      if (version.isCurrent) return domain;

      const timestamp = nowIso();
      domain.versions = domain.versions.map((v) => ({ ...v, isCurrent: v.id === versionId }));
      domain.currentVersionId = versionId;
      domain.updatedAt = timestamp;

      const updated = recomputeProduction(domain);
      await persistSnapshot(tx, updated);

      await addActivity(tx, {
        assetId,
        assetName: updated.name,
        action: `Version promoted: v${version.versionNumber} — ${version.label}`,
        timestamp,
        source: "curator",
      });

      return updated;
    });

    return { ok: true, asset };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof Error) {
      if (error.message === "ASSET_NOT_FOUND") return { ok: false, error: "Asset not found." };
      if (error.message === "VERSION_NOT_FOUND") return { ok: false, error: "Version not found." };
    }
    console.error("promoteVersionAction failed", error);
    return { ok: false, error: "Could not promote this version. Please try again." };
  }
}

export async function deleteVersionAction(
  assetId: string,
  versionId: string,
): Promise<{ ok: boolean; error?: string; asset?: Asset }> {
  try {
    await assertServerRole("ADMIN");
    const asset = await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) throw new Error("ASSET_NOT_FOUND");

      const domain = loaded.domain;
      const version = domain.versions.find((v) => v.id === versionId);
      if (!version) throw new Error("VERSION_NOT_FOUND");
      if (version.isCurrent) throw new Error("VERSION_IS_CURRENT");

      const timestamp = nowIso();
      domain.versions = domain.versions.filter((v) => v.id !== versionId);
      domain.updatedAt = timestamp;

      const updated = recomputeProduction(domain);
      await persistSnapshot(tx, updated);
      await removeVersionMedia(version);

      await addActivity(tx, {
        assetId,
        assetName: updated.name,
        action: `Version deleted: v${version.versionNumber} — ${version.label}`,
        timestamp,
        source: "curator",
      });

      return updated;
    });

    return { ok: true, asset };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (error instanceof Error) {
      if (error.message === "ASSET_NOT_FOUND") return { ok: false, error: "Asset not found." };
      if (error.message === "VERSION_NOT_FOUND") return { ok: false, error: "Version not found." };
      if (error.message === "VERSION_IS_CURRENT") {
        return { ok: false, error: "The current version cannot be deleted. Promote another version first." };
      }
    }
    console.error("deleteVersionAction failed", error);
    return { ok: false, error: "Could not delete this version. Please try again." };
  }
}

export async function ignoreDuplicateAction(duplicateId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertServerRole("CURATOR");
    await prisma.ignoredDuplicate.upsert({
      where: { duplicateId },
      create: { duplicateId },
      update: {},
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("ignoreDuplicateAction failed", error);
    return { ok: false };
  }
}

export async function bulkAddTagAction(
  assetIds: string[],
  tag: string,
): Promise<{ ok: boolean; error?: string; assets?: Asset[] }> {
  const trimmed = tag.trim();
  if (!trimmed) return { ok: false, error: "Tag cannot be empty." };

  try {
    await assertServerRole("CURATOR");
    const assets = await withTransaction(async (tx) => {
      const timestamp = nowIso();
      const touched: Asset[] = [];

      for (const id of assetIds) {
        const loaded = await loadAsset(tx, id);
        if (!loaded) continue;
        let domain = loaded.domain;
        if (!domain.tags.includes(trimmed)) {
          domain = {
            ...domain,
            tags: [...domain.tags, trimmed],
            updatedAt: timestamp,
          };
          domain = recomputeProduction(domain);
          await persistSnapshot(tx, domain);
        }
        // Re-evaluate readiness is above; sync the asset's session state so
        // accepted/dismissed tracking remains intact after the bulk change.
        await updateSessionState(tx, id, loaded.aiSessionState);
        touched.push(domain);

        await addActivity(tx, {
          assetId: id,
          assetName: domain.name,
          action: `Bulk tag added: "${trimmed}"`,
          timestamp,
          source: "curator",
        });

        // Automated curation rules gate: a tag change can move an asset into
        // the automatic production-ready set.
        const curation = runCurationRules(domain, loaded.aiSessionState);
        if (curation.promoted) {
          await persistSnapshot(tx, curation.domain);
          await addActivity(tx, {
            assetId: id,
            assetName: curation.domain.name,
            action: "Auto-promoted to production ready (curation rules)",
            timestamp,
            source: "curator",
          });
        }
      }
      return touched;
    });
    return { ok: true, assets };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("bulkAddTagAction failed", error);
    return { ok: false, error: "Could not apply bulk tag. Please try again." };
  }
}

export async function bulkRemoveTagAction(
  assetIds: string[],
  tag: string,
): Promise<{ ok: boolean; error?: string; assets?: Asset[] }> {
  try {
    await assertServerRole("CURATOR");
    const assets = await withTransaction(async (tx) => {
      const timestamp = nowIso();
      const touched: Asset[] = [];

      for (const id of assetIds) {
        const loaded = await loadAsset(tx, id);
        if (!loaded) continue;
        let domain = loaded.domain;
        if (domain.tags.includes(tag)) {
          domain = {
            ...domain,
            tags: domain.tags.filter((t) => t !== tag),
            updatedAt: timestamp,
          };
          domain = recomputeProduction(domain);
          await persistSnapshot(tx, domain);
        }
        // Re-evaluate readiness is above; sync the asset's session state so
        // accepted/dismissed tracking remains intact after the bulk change.
        await updateSessionState(tx, id, loaded.aiSessionState);
        touched.push(domain);

        await addActivity(tx, {
          assetId: id,
          assetName: domain.name,
          action: `Bulk tag removed: "${tag}"`,
          timestamp,
          source: "curator",
        });

        // Automated curation rules gate is evaluated per asset for uniformity.
        const curation = runCurationRules(domain, loaded.aiSessionState);
        if (curation.promoted) {
          await persistSnapshot(tx, curation.domain);
          await addActivity(tx, {
            assetId: id,
            assetName: curation.domain.name,
            action: "Auto-promoted to production ready (curation rules)",
            timestamp,
            source: "curator",
          });
        }
      }
      return touched;
    });
    return { ok: true, assets };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("bulkRemoveTagAction failed", error);
    return { ok: false, error: "Could not remove tag. Please try again." };
  }
}

export async function bulkMoveToCollectionAction(
  assetIds: string[],
  collectionId: string,
): Promise<{ ok: boolean; error?: string; assets?: Asset[] }> {
  try {
    await assertServerRole("CURATOR");
    const assets = await withTransaction(async (tx) => {
      const collectionRow = await tx.collection.findUnique({ where: { id: collectionId } });
      const timestamp = nowIso();
      const touched: Asset[] = [];

      for (const id of assetIds) {
        const loaded = await loadAsset(tx, id);
        if (!loaded) continue;
        let domain = loaded.domain;
        domain = { ...domain, collectionId, updatedAt: timestamp };
        domain = recomputeProduction(domain);
        await persistSnapshot(tx, domain);
        // Re-evaluate readiness is above; sync the asset's session state so
        // collection overrides remain intact after the bulk move.
        await updateSessionState(tx, id, loaded.aiSessionState);
        touched.push(domain);

        if (collectionRow) {
          await addActivity(tx, {
            assetId: id,
            assetName: domain.name,
            action: `Moved to collection: ${collectionRow.name}`,
            timestamp,
            source: "curator",
          });
        }

        // Automated curation rules gate is evaluated per asset after the move.
        const curation = runCurationRules(domain, loaded.aiSessionState);
        if (curation.promoted) {
          await persistSnapshot(tx, curation.domain);
          await addActivity(tx, {
            assetId: id,
            assetName: curation.domain.name,
            action: "Auto-promoted to production ready (curation rules)",
            timestamp,
            source: "curator",
          });
        }
      }
      return touched;
    });
    return { ok: true, assets };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("bulkMoveToCollectionAction failed", error);
    return { ok: false, error: "Could not move assets. Please try again." };
  }
}

export async function resetDemoAction(): Promise<{
  ok: boolean;
  error?: string;
  snapshot?: {
    assets: Asset[];
    collections: Collection[];
    activity: Awaited<ReturnType<typeof getActivity>>;
    comparisons: Awaited<ReturnType<typeof getComparisons>>;
    feedback: CuratorFeedbackEntry[];
    ignoredDuplicateIds: string[];
  };
}> {
  try {
    await assertServerRole("ADMIN");
    await resetDemoData();

    const [assets, cols, activity, comparisons, feedback, ignoredDuplicateIds] =
      await Promise.all([
        getAssets(),
        fetchCollections(),
        getActivity(),
        getComparisons(),
        getFeedbackEntries(),
        getIgnoredDuplicateIds(),
      ]);

    return {
      ok: true,
      snapshot: {
        assets,
        collections: cols,
        activity,
        comparisons,
        feedback,
        ignoredDuplicateIds,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("resetDemoAction failed", error);
    return { ok: false, error: "Could not reset the demo workspace." };
  }
}

export async function fetchFeedAction(): Promise<{
  ok: boolean;
  error?: string;
  activity?: ActivityItem[];
  comparisons?: ComparisonRecord[];
  feedback?: CuratorFeedbackEntry[];
}> {
  try {
    await assertServerRole("VIEWER");
    const [activity, comparisons, feedback] = await Promise.all([
      getActivity(),
      getComparisons(),
      getFeedbackEntries(),
    ]);
    return { ok: true, activity, comparisons, feedback };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("fetchFeedAction failed", error);
    return { ok: false, error: "Could not refresh recent activity." };
  }
}

/**
 * Hybrid vector + full-text search over the asset inventory. Returns the
 * matching assets (full domain objects, including versions and decision
 * history) ordered by descending hybrid confidence, together with the raw
 * hit metrics so the UI can show why each asset matched.
 */
export async function searchAssetsAction(
  query: string,
  limit = 12,
  vectorWeight?: number,
): Promise<{
  ok: boolean;
  error?: string;
  assets?: Asset[];
  hits?: AssetSearchHit[];
}> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: true, assets: [], hits: [] };

  try {
    await assertServerRole("VIEWER");
    const { assets, hits } = await hybridSearchAssets({ query: trimmed, limit, vectorWeight });
    return { ok: true, assets, hits };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("searchAssetsAction failed", error);
    return { ok: false, error: "Could not search assets. Please try again." };
  }
}

/**
 * Stage 4.2 — Full inventory re-index for hybrid search.
 *
 * CURATOR+ only. Rebuilds `searchText` + pgvector embeddings for every asset
 * in batches (see `reindexAllAssets`) and reports the processed count, any
 * per-asset failures, and the total wall-clock duration.
 */
export async function reindexAllAssetsAction(): Promise<{
  ok: boolean;
  error?: string;
  count?: number;
  failed?: number;
  durationMs?: number;
}> {
  try {
    await assertServerRole("CURATOR");
    const result = await reindexAllAssets();
    return { ok: true, count: result.count, failed: result.failed, durationMs: result.durationMs };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("reindexAllAssetsAction failed", error);
    return { ok: false, error: "Could not rebuild the search index. Please try again." };
  }
}

/**
 * Stage 4.2 — Export pipeline server action.
 *
 * Packages the requested assets (specific ids or every asset in a collection)
 * into a ZIP archive and returns it base64-encoded with a suggested filename,
 * so the client can trigger a download without a separate streaming endpoint.
 * Mirrors the `/api/export` download endpoint.
 */
export async function exportAssetsAction(
  opts: { assetIds?: string[]; collectionId?: string },
): Promise<{ ok: boolean; error?: string; base64?: string; fileName?: string }> {
  try {
    await assertServerRole("VIEWER");
    const collectionId = opts.collectionId?.trim();
    const assetIds = (opts.assetIds ?? []).map((s) => s.trim()).filter(Boolean);

    let assets: Asset[];
    let label = "assets";

    if (collectionId) {
      const all = await getAssets();
      assets = all.filter((a) => a.collectionId === collectionId);
      const collections = await fetchCollections();
      label = collections.find((c) => c.id === collectionId)?.name ?? "collection";
    } else if (assetIds.length > 0) {
      const loaded: Asset[] = [];
      for (const id of assetIds) {
        const asset = await getAssetById(id);
        if (asset) loaded.push(asset);
      }
      assets = loaded;
      label = loaded.length === 1 ? loaded[0].name : "assets";
    } else {
      return { ok: false, error: "Provide assetIds or collectionId to export." };
    }

    if (assets.length === 0) {
      return { ok: false, error: "No assets matched the export request." };
    }

    const collections = await fetchCollections();
    const { buffer, fileName } = await buildExportZip(assets, collections, label);
    return { ok: true, base64: buffer.toString("base64"), fileName };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("exportAssetsAction failed", error);
    return { ok: false, error: "Could not export assets. Please try again." };
  }
}
