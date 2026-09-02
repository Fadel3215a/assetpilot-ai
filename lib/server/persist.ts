import type {
  ActivityItem,
  AssetVersion,
  ComparisonRecord,
  CuratorFeedbackEntry,
  DecisionHistoryEntry,
} from "@/types";
import { Prisma } from "@/lib/generated/prisma/client";
import { toDbAssetType } from "@/lib/server/mappers";

type JsonInput = import("@/lib/generated/prisma/client").Prisma.InputJsonValue;

export function toJsonInput<T>(value: T): JsonInput {
  return value as unknown as JsonInput;
}

export const DEFAULT_SESSION_STATE = {
  dismissedTagIds: [],
  dismissedObservationIds: [],
  acceptedTagIds: [],
  acceptedObservationIds: [],
  collectionOverrides: [],
  aiAssistedReview: false,
};

export function versionToRow(v: AssetVersion) {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    label: v.label,
    thumbnailPath: v.thumbnailPath,
    previewPath: v.previewPath,
    mediaUrl: v.mediaUrl ?? null,
    metadata: toJsonInput(v.metadata),
    qualityScore: toJsonInput(v.qualityScore),
    reviewDecision: toJsonInput(v.reviewDecision),
    curatorChecklist: v.curatorChecklist ? toJsonInput(v.curatorChecklist) : Prisma.DbNull,
    curatorScore: v.curatorScore ?? null,
    isCurrent: v.isCurrent,
    createdAt: new Date(v.createdAt),
  };
}

export function historyToRow(entry: DecisionHistoryEntry) {
  return {
    id: entry.id,
    timestamp: new Date(entry.timestamp),
    reviewer: entry.reviewer,
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    decision: entry.decision,
    reason: entry.reason ?? null,
    curatorScore: entry.curatorScore ?? null,
  };
}

export function activityToRow(item: ActivityItem) {
  return {
    id: item.id,
    assetId: item.assetId,
    assetName: item.assetName,
    action: item.action,
    source: item.source,
    timestamp: new Date(item.timestamp),
  };
}

export function comparisonToRow(record: ComparisonRecord) {
  return {
    id: record.id,
    timestamp: new Date(record.timestamp),
    reviewer: record.reviewer,
    itemAAssetId: record.itemA.assetId,
    itemAVersionId: record.itemA.versionId,
    itemALabel: record.itemA.label,
    itemBAssetId: record.itemB.assetId,
    itemBVersionId: record.itemB.versionId,
    itemBLabel: record.itemB.label,
    decision: record.decision,
    reason: record.reason,
  };
}

export function assetColumns(a: import("@/types").Asset) {
  return {
    id: a.id,
    name: a.name,
    type: toDbAssetType(a.type),
    status: a.status,
    collectionId: a.collectionId,
    tags: [...a.tags],
    isAiGenerated: a.isAiGenerated,
    priority: a.priority,
    currentVersionId: a.currentVersionId || null,
    usageNotes: a.usageNotes ?? null,
    isSessionUpload: a.isSessionUpload === true,
    extractedMetadata: a.extractedMetadata
      ? toJsonInput(a.extractedMetadata)
      : Prisma.DbNull,
    aiAnalysis: toJsonInput(a.aiAnalysis),
    productionReadiness: toJsonInput(a.productionReadiness),
    createdAt: new Date(a.createdAt),
    updatedAt: new Date(a.updatedAt),
  };
}

export function feedbackToRow(entry: CuratorFeedbackEntry) {
  return {
    id: entry.id,
    assetId: entry.assetId,
    suggestionType: entry.suggestionType,
    suggestion: entry.suggestion,
    curatorAction: entry.curatorAction,
    finalValue: entry.finalValue ?? null,
    timestamp: new Date(entry.timestamp),
  };
}
