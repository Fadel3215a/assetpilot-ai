"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getAsyncAIAnalysisProvider,
} from "@/lib/server/ai-provider";
import { inferUploadCategory, mapCategoryToAssetType } from "@/lib/file-metadata";
import { prisma, withTransaction, type TxClient } from "@/lib/db";
import { buildNewVersion, buildUploadedAsset } from "@/lib/upload-asset";
import { calculateCuratorScore } from "@/lib/quality";
import { evaluateProductionCriteria } from "@/lib/production";
import { statusFromDecision } from "@/lib/utils";
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
  getAssets,
  getCollections as fetchCollections,
  getComparisons,
  getFeedbackEntries,
  getIgnoredDuplicateIds,
} from "@/lib/server/queries";
import type {
  ActivityItem,
  Asset,
  AssetAISessionState,
  ChecklistRating,
  Collection,
  ComparisonDecisionType,
  ComparisonRecord,
  CuratorFeedbackEntry,
  QualityCriterion,
  ReviewDecisionType,
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
  file: File,
): Promise<void> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(STORAGE_ROOT, storedName), bytes);
}

function nextVersionIdOf(asset: Asset): string {
  const nextNumber = Math.max(...asset.versions.map((v) => v.versionNumber)) + 1;
  return `ver-${asset.id}-${nextNumber}`;
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

      if (prod.ready && action === "APPROVED") {
        domain.status = "PRODUCTION_READY";
      }

      await persistSnapshot(tx, domain);
      await addActivity(tx, {
        assetId,
        assetName: domain.name,
        action: reviewActionLabel(action),
        timestamp,
        source: "curator",
      });

      return domain;
    });

    return { ok: true, asset };
  } catch (error) {
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
    console.error("editTagSuggestionAction failed", error);
    return { ok: false, error: "Could not edit this tag. Please try again." };
  }
}

export async function dismissTagSuggestionAction(
  assetId: string,
  tagId: string,
): Promise<{ ok: boolean; error?: string; feedback?: CuratorFeedbackEntry }> {
  try {
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
    console.error("dismissTagSuggestionAction failed", error);
    return { ok: false, error: "Could not dismiss this tag. Please try again." };
  }
}

export async function acceptCollectionSuggestionAction(
  assetId: string,
  collectionId: string,
): Promise<{ ok: boolean; error?: string; asset?: Asset; feedback?: CuratorFeedbackEntry }> {
  try {
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
    console.error("acceptCollectionSuggestionAction failed", error);
    return { ok: false, error: "Could not accept this collection. Please try again." };
  }
}

export async function acceptObservationAction(
  assetId: string,
  observationId: string,
): Promise<{ ok: boolean; error?: string; feedback?: CuratorFeedbackEntry }> {
  try {
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
    console.error("acceptObservationAction failed", error);
    return { ok: false, error: "Could not accept this observation. Please try again." };
  }
}

export async function dismissObservationAction(
  assetId: string,
  observationId: string,
): Promise<{ ok: boolean; error?: string; feedback?: CuratorFeedbackEntry }> {
  try {
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
    console.error("dismissObservationAction failed", error);
    return { ok: false, error: "Could not dismiss this observation. Please try again." };
  }
}

export async function markAIAssistedReviewAction(
  assetId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
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

    let domain = buildUploadedAsset(extracted, type, mediaPath, collectionId, collections, {
      isSessionUpload: false,
      id: assetId,
    });

    await persistUploadBytes(storedName, file);

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

    return { ok: true, assetId: domain.id, asset: domain };
  } catch (error) {
    console.error("uploadAssetAction failed", error);
    return { ok: false, error: "Could not process uploaded file." };
  }
}

export async function updateAssetMetadataAction(
  assetId: string,
  payload: { name: string; description: string; tags: string[]; collectionId: string; usageNotes: string },
): Promise<{ ok: boolean; error?: string; asset?: Asset }> {
  try {
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
      await persistSnapshot(tx, domain);

      await addActivity(tx, {
        assetId,
        assetName: payload.name,
        action: "Metadata updated",
        timestamp,
        source: "curator",
      });

      return domain;
    });

    return { ok: true, asset };
  } catch (error) {
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
    await withTransaction(async (tx) => {
      const loaded = await loadAsset(tx, assetId);
      if (!loaded) throw new Error("ASSET_NOT_FOUND");
      const collections = await loadCollectionsTx(tx);

      let objectUrl: string | null = null;
      if (hasFile && extracted && file instanceof File) {
        const versionId = nextVersionIdOf(loaded.domain);
        const storedName = `${versionId}-${sanitizeFileName(file.name)}`;
        objectUrl = mediaUrlFor(versionId, file.name);
        await persistUploadBytes(storedName, file);
      }

      let updated = buildNewVersion(loaded.domain, objectUrl, extracted, label);
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

    return { ok: true, asset: resultAsset };
  } catch (error) {
    if (error instanceof Error && error.message === "ASSET_NOT_FOUND") {
      return { ok: false, error: "Asset not found." };
    }
    console.error("createAssetVersionAction failed", error);
    return { ok: false, error: "Could not create version." };
  }
}

export async function ignoreDuplicateAction(duplicateId: string): Promise<{ ok: boolean }> {
  await prisma.ignoredDuplicate.upsert({
    where: { duplicateId },
    create: { duplicateId },
    update: {},
  });
  return { ok: true };
}

export async function bulkAddTagAction(
  assetIds: string[],
  tag: string,
): Promise<{ ok: boolean; error?: string; assets?: Asset[] }> {
  const trimmed = tag.trim();
  if (!trimmed) return { ok: false, error: "Tag cannot be empty." };

  try {
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
      }
      return touched;
    });
    return { ok: true, assets };
  } catch (error) {
    console.error("bulkAddTagAction failed", error);
    return { ok: false, error: "Could not apply bulk tag. Please try again." };
  }
}

export async function bulkRemoveTagAction(
  assetIds: string[],
  tag: string,
): Promise<{ ok: boolean; error?: string; assets?: Asset[] }> {
  try {
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
      }
      return touched;
    });
    return { ok: true, assets };
  } catch (error) {
    console.error("bulkRemoveTagAction failed", error);
    return { ok: false, error: "Could not remove tag. Please try again." };
  }
}

export async function bulkMoveToCollectionAction(
  assetIds: string[],
  collectionId: string,
): Promise<{ ok: boolean; error?: string; assets?: Asset[] }> {
  try {
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
      }
      return touched;
    });
    return { ok: true, assets };
  } catch (error) {
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
    const [activity, comparisons, feedback] = await Promise.all([
      getActivity(),
      getComparisons(),
      getFeedbackEntries(),
    ]);
    return { ok: true, activity, comparisons, feedback };
  } catch (error) {
    console.error("fetchFeedAction failed", error);
    return { ok: false, error: "Could not refresh recent activity." };
  }
}
