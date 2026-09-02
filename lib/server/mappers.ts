import type {
  ActivityItem,
  AIAnalysis,
  Asset,
  AssetAISessionState,
  AssetMetadata,
  AssetVersion,
  Collection,
  ComparisonRecord,
  CuratorFeedbackEntry,
  DecisionHistoryEntry,
  ExtractedFileMetadata,
  ProductionReadiness,
  QualityCriterion,
  QualityScore,
  ReviewDecision,
} from "@/types";
import type {
  ActivitySource,
  AISuggestionType,
  AssetStatus,
  AssetType as DbAssetType,
  ComparisonDecisionType,
  CuratorFeedbackAction,
  ReviewDecisionType,
} from "@/lib/generated/prisma/enums";

type PrismaAssetRow = import("@/lib/generated/prisma/client").Prisma.AssetGetPayload<{
  include: { versions: true; decisionHistory: true };
}>;

type PrismaVersionRow = {
  id: string;
  assetId: string;
  versionNumber: number;
  label: string;
  thumbnailPath: string;
  previewPath: string;
  mediaUrl: string | null;
  metadata: unknown;
  qualityScore: unknown;
  reviewDecision: unknown;
  curatorChecklist: unknown;
  curatorScore: number | null;
  isCurrent: boolean;
  createdAt: Date;
};

export function toDbAssetType(type: Asset["type"]): DbAssetType {
  return type === "3d" ? "THREE_D" : type;
}

export function fromDbAssetType(type: DbAssetType): Asset["type"] {
  return type === "THREE_D" ? "3d" : type;
}

function iso(value: Date): string {
  return value.toISOString();
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Corrupted JSON column: expected object for ${label}`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Corrupted JSON column: expected array for ${label}`);
  }
  return value;
}

function reqString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`Corrupted JSON column: missing string ${label}.${key}`);
  }
  return value;
}

function optString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function reqNumber(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new Error(`Corrupted JSON column: missing number ${label}.${key}`);
  }
  return value;
}

function optNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function optDimensions(record: Record<string, unknown>): { width: number; height: number } | undefined {
  const raw = record.dimensions;
  if (typeof raw !== "object" || raw === null) return undefined;
  const dims = raw as Record<string, unknown>;
  if (typeof dims.width !== "number" || typeof dims.height !== "number") return undefined;
  return { width: dims.width, height: dims.height };
}

function optBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function optExif(record: Record<string, unknown>): ExtractedFileMetadata["exif"] {
  const raw = record.exif;
  if (typeof raw !== "object" || raw === null) return undefined;
  const rec = raw as Record<string, unknown>;
  const out: Exclude<ExtractedFileMetadata["exif"], undefined> = {};
  if (typeof rec.make === "string") out.make = rec.make;
  if (typeof rec.model === "string") out.model = rec.model;
  if (typeof rec.orientation === "number") out.orientation = rec.orientation;
  if (typeof rec.dateTime === "string") out.dateTime = rec.dateTime;
  if (typeof rec.dateTimeOriginal === "string") out.dateTimeOriginal = rec.dateTimeOriginal;
  if (typeof rec.iso === "number") out.iso = rec.iso;
  if (typeof rec.fNumber === "number") out.fNumber = rec.fNumber;
  if (typeof rec.exposureTime === "number") out.exposureTime = rec.exposureTime;
  if (typeof rec.focalLengthIn35mm === "number") out.focalLengthIn35mm = rec.focalLengthIn35mm;
  if (typeof rec.lensModel === "string") out.lensModel = rec.lensModel;
  return Object.keys(out).length > 0 ? out : undefined;
}

function stringArray(value: unknown, label: string): string[] {
  return asArray(value, label).map((item, i) => {
    if (typeof item !== "string") {
      throw new Error(`Corrupted JSON column: non-string entry in ${label}[${i}]`);
    }
    return item;
  });
}

const REVIEW_DECISION_TYPES: ReviewDecisionType[] = [
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
  "PENDING",
];

const CHECKLIST_RATINGS = ["PASS", "NEEDS_REVIEW", "FAIL"] as const;

const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

const PRODUCTION_SUGGESTIONS = [
  "READY_FOR_VERIFICATION",
  "REVIEW_REQUIRED",
  "NOT_RECOMMENDED",
] as const;

export function parseAssetMetadata(value: unknown): AssetMetadata {
  const rec = asRecord(value, "metadata");
  return {
    title: reqString(rec, "title", "metadata"),
    description: reqString(rec, "description", "metadata"),
    prompt: optString(rec, "prompt"),
    generator: optString(rec, "generator"),
    dimensions: optDimensions(rec),
    duration: optNumber(rec, "duration"),
    format: reqString(rec, "format", "metadata"),
    fileSize: reqNumber(rec, "fileSize", "metadata"),
    fileName: optString(rec, "fileName"),
    mimeType: optString(rec, "mimeType"),
    createdAt: reqString(rec, "createdAt", "metadata"),
    updatedAt: reqString(rec, "updatedAt", "metadata"),
  };
}

export function parseQualityScore(value: unknown): QualityScore {
  const rec = asRecord(value, "qualityScore");
  return {
    overall: reqNumber(rec, "overall", "qualityScore"),
    visualClarity: optNumber(rec, "visualClarity"),
    consistency: optNumber(rec, "consistency"),
    technicalQuality: optNumber(rec, "technicalQuality"),
    brandAlignment: optNumber(rec, "brandAlignment"),
    notes: optString(rec, "notes"),
  };
}

export function parseReviewDecision(value: unknown): ReviewDecision {
  const rec = asRecord(value, "reviewDecision");
  const type = reqString(rec, "type", "reviewDecision") as ReviewDecisionType;
  if (!REVIEW_DECISION_TYPES.includes(type)) {
    throw new Error(`Corrupted JSON column: invalid review decision type "${type}"`);
  }
  const notes = optString(rec, "notes");
  return {
    type,
    reviewer: reqString(rec, "reviewer", "reviewDecision"),
    decidedAt: reqString(rec, "decidedAt", "reviewDecision"),
    ...(notes !== undefined ? { notes } : {}),
  };
}

export function parseQualityCriteria(value: unknown): QualityCriterion[] {
  return asArray(value, "curatorChecklist").map((entry, i) => {
    const rec = asRecord(entry, `curatorChecklist[${i}]`);
    const rating = reqString(rec, "rating", `curatorChecklist[${i}]`);
    if (!(CHECKLIST_RATINGS as readonly string[]).includes(rating)) {
      throw new Error(`Corrupted JSON column: invalid checklist rating "${rating}"`);
    }
    return {
      id: reqString(rec, "id", `curatorChecklist[${i}]`),
      label: reqString(rec, "label", `curatorChecklist[${i}]`),
      rating: rating as QualityCriterion["rating"],
    };
  });
}

export function parseExtractedMetadata(value: unknown): ExtractedFileMetadata {
  const rec = asRecord(value, "extractedMetadata");
  return {
    fileName: reqString(rec, "fileName", "extractedMetadata"),
    extension: reqString(rec, "extension", "extractedMetadata"),
    mimeType: reqString(rec, "mimeType", "extractedMetadata"),
    fileSize: reqNumber(rec, "fileSize", "extractedMetadata"),
    dimensions: optDimensions(rec),
    duration: optNumber(rec, "duration"),
    lastModified: optNumber(rec, "lastModified"),
    aspectRatio: optNumber(rec, "aspectRatio"),
    colorSpace: optString(rec, "colorSpace"),
    iccProfile: typeof rec.iccProfile === "string" ? rec.iccProfile : undefined,
    hasAlpha: optBoolean(rec, "hasAlpha"),
    bitDepth: optNumber(rec, "bitDepth"),
    orientation: optNumber(rec, "orientation"),
    exif: optExif(rec),
  };
}

export function parseProductionReadiness(value: unknown): ProductionReadiness {
  const rec = asRecord(value, "productionReadiness");
  const readyAt = optString(rec, "readyAt");
  return {
    score: reqNumber(rec, "score", "productionReadiness"),
    checklist: asArray(rec.checklist ?? [], "productionReadiness.checklist").map(
      (entry, i): ProductionReadiness["checklist"][number] => {
        const item = asRecord(entry, `productionReadiness.checklist[${i}]`);
        return {
          id: reqString(item, "id", "readiness item"),
          label: reqString(item, "label", "readiness item"),
          completed: item.completed === true,
        };
      },
    ),
    ...(readyAt !== undefined ? { readyAt } : {}),
  };
}

export function parseAIAnalysis(value: unknown): AIAnalysis {
  const rec = asRecord(value, "aiAnalysis");
  const confidence = reqString(rec, "confidence", "aiAnalysis");
  if (!(CONFIDENCE_LEVELS as readonly string[]).includes(confidence)) {
    throw new Error(`Corrupted JSON column: invalid aiAnalysis confidence "${confidence}"`);
  }

  const prodRec = asRecord(rec.productionSuggestion ?? {}, "aiAnalysis.productionSuggestion");
  const recommendation = reqString(prodRec, "recommendation", "aiAnalysis.productionSuggestion");
  if (!(PRODUCTION_SUGGESTIONS as readonly string[]).includes(recommendation)) {
    throw new Error(`Corrupted JSON column: invalid production suggestion "${recommendation}"`);
  }

  return {
    summary: reqString(rec, "summary", "aiAnalysis"),
    strengths: stringArray(rec.strengths ?? [], "aiAnalysis.strengths"),
    potentialIssues: stringArray(rec.potentialIssues ?? [], "aiAnalysis.potentialIssues"),
    suggestedTags: asArray(rec.suggestedTags ?? [], "aiAnalysis.suggestedTags").map((entry, i) => {
      const tag = asRecord(entry, `suggestedTags[${i}]`);
      return {
        id: reqString(tag, "id", "suggestedTag"),
        tag: reqString(tag, "tag", "suggestedTag"),
        explanation: reqString(tag, "explanation", "suggestedTag"),
      };
    }),
    suggestedCollectionId: reqString(rec, "suggestedCollectionId", "aiAnalysis"),
    suggestedCollectionExplanation: reqString(
      rec,
      "suggestedCollectionExplanation",
      "aiAnalysis",
    ),
    productionSuggestion: {
      recommendation: recommendation as AIAnalysis["productionSuggestion"]["recommendation"],
      summary: reqString(prodRec, "summary", "aiAnalysis.productionSuggestion"),
      explanation: reqString(prodRec, "explanation", "aiAnalysis.productionSuggestion"),
    },
    observations: asArray(rec.observations ?? [], "aiAnalysis.observations").map((entry, i) => {
      const obs = asRecord(entry, `observations[${i}]`);
      return {
        id: reqString(obs, "id", "observation"),
        text: reqString(obs, "text", "observation"),
        explanation: reqString(obs, "explanation", "observation"),
      };
    }),
    confidence: confidence as AIAnalysis["confidence"],
    generatedAt: reqString(rec, "generatedAt", "aiAnalysis"),
  };
}

export function parseSessionState(value: unknown): AssetAISessionState {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      dismissedTagIds: [],
      dismissedObservationIds: [],
      acceptedTagIds: [],
      acceptedObservationIds: [],
      collectionOverrides: [],
      aiAssistedReview: false,
    };
  }
  const rec = value as Record<string, unknown>;
  try {
    return {
      dismissedTagIds: stringArray(rec.dismissedTagIds ?? [], "aiSessionState.dismissedTagIds"),
      dismissedObservationIds: stringArray(
        rec.dismissedObservationIds ?? [],
        "aiSessionState.dismissedObservationIds",
      ),
      acceptedTagIds: stringArray(rec.acceptedTagIds ?? [], "aiSessionState.acceptedTagIds"),
      acceptedObservationIds: stringArray(
        rec.acceptedObservationIds ?? [],
        "aiSessionState.acceptedObservationIds",
      ),
      collectionOverrides: stringArray(
        rec.collectionOverrides ?? [],
        "aiSessionState.collectionOverrides",
      ),
      aiAssistedReview: rec.aiAssistedReview === true,
    };
  } catch {
    return {
      dismissedTagIds: [],
      dismissedObservationIds: [],
      acceptedTagIds: [],
      acceptedObservationIds: [],
      collectionOverrides: [],
      aiAssistedReview: false,
    };
  }
}

export function toDomainVersion(row: PrismaVersionRow): AssetVersion {
  const curatorChecklist = row.curatorChecklist
    ? parseQualityCriteria(row.curatorChecklist)
    : undefined;
  const curatorScore = row.curatorScore ?? undefined;
  const mediaUrl = row.mediaUrl ?? undefined;
  const version: AssetVersion = {
    id: row.id,
    versionNumber: row.versionNumber,
    label: row.label,
    thumbnailPath: row.thumbnailPath,
    previewPath: row.previewPath,
    metadata: parseAssetMetadata(row.metadata),
    qualityScore: parseQualityScore(row.qualityScore),
    reviewDecision: parseReviewDecision(row.reviewDecision),
    createdAt: iso(row.createdAt),
    isCurrent: row.isCurrent,
    ...(mediaUrl !== undefined ? { mediaUrl } : {}),
    ...(curatorChecklist !== undefined ? { curatorChecklist } : {}),
    ...(curatorScore !== undefined ? { curatorScore } : {}),
  };
  return version;
}

export function toDomainHistory(row: {
  id: string;
  assetId: string;
  timestamp: Date;
  reviewer: string;
  previousStatus: AssetStatus;
  newStatus: AssetStatus;
  decision: ReviewDecisionType;
  reason: string | null;
  curatorScore: number | null;
}): DecisionHistoryEntry {
  const reason = row.reason ?? undefined;
  const curatorScore = row.curatorScore ?? undefined;
  return {
    id: row.id,
    assetId: row.assetId,
    timestamp: iso(row.timestamp),
    reviewer: row.reviewer,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    decision: row.decision,
    ...(reason !== undefined ? { reason } : {}),
    ...(curatorScore !== undefined ? { curatorScore } : {}),
  };
}

export function toDomainCollection(row: {
  id: string;
  name: string;
  description: string;
  color: string;
}): Collection {
  return { id: row.id, name: row.name, description: row.description, color: row.color };
}

export function toDomainAsset(row: PrismaAssetRow): Asset {
  const versions = [...row.versions]
    .sort((a, b) => a.versionNumber - b.versionNumber)
    .map(toDomainVersion);

  const currentFromPointer = versions.find((v) => v.id === row.currentVersionId);
  const currentFallback = versions.find((v) => v.isCurrent);
  const currentVersionId = currentFromPointer?.id ?? currentFallback?.id ?? "";

  const extractedMetadata =
    row.extractedMetadata != null ? parseExtractedMetadata(row.extractedMetadata) : undefined;
  const usageNotes = row.usageNotes ?? undefined;

  const asset: Asset = {
    id: row.id,
    name: row.name,
    type: fromDbAssetType(row.type),
    status: row.status,
    collectionId: row.collectionId,
    tags: [...row.tags],
    isAiGenerated: row.isAiGenerated,
    priority: row.priority,
    currentVersionId,
    versions,
    productionReadiness: parseProductionReadiness(row.productionReadiness),
    decisionHistory: [...row.decisionHistory]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .map(toDomainHistory),
    aiAnalysis: parseAIAnalysis(row.aiAnalysis),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    ...(usageNotes !== undefined ? { usageNotes } : {}),
    ...(extractedMetadata !== undefined ? { extractedMetadata } : {}),
    ...(row.isSessionUpload ? { isSessionUpload: true } : {}),
  };
  return asset;
}

export function toDomainActivity(row: {
  id: string;
  assetId: string;
  assetName: string;
  action: string;
  source: ActivitySource;
  timestamp: Date;
}): ActivityItem {
  return {
    id: row.id,
    assetId: row.assetId,
    assetName: row.assetName,
    action: row.action,
    timestamp: iso(row.timestamp),
    source: row.source,
  };
}

export function toDomainComparison(row: {
  id: string;
  timestamp: Date;
  reviewer: string;
  itemAAssetId: string;
  itemAVersionId: string;
  itemALabel: string;
  itemBAssetId: string;
  itemBVersionId: string;
  itemBLabel: string;
  decision: ComparisonDecisionType;
  reason: string;
}): ComparisonRecord {
  return {
    id: row.id,
    timestamp: iso(row.timestamp),
    reviewer: row.reviewer,
    itemA: { assetId: row.itemAAssetId, versionId: row.itemAVersionId, label: row.itemALabel },
    itemB: { assetId: row.itemBAssetId, versionId: row.itemBVersionId, label: row.itemBLabel },
    decision: row.decision,
    reason: row.reason,
  };
}

export function toDomainFeedback(row: {
  id: string;
  assetId: string;
  suggestionType: AISuggestionType;
  suggestion: string;
  curatorAction: CuratorFeedbackAction;
  finalValue: string | null;
  timestamp: Date;
}): CuratorFeedbackEntry {
  const finalValue = row.finalValue ?? undefined;
  return {
    id: row.id,
    assetId: row.assetId,
    suggestionType: row.suggestionType,
    suggestion: row.suggestion,
    curatorAction: row.curatorAction,
    timestamp: iso(row.timestamp),
    ...(finalValue !== undefined ? { finalValue } : {}),
  };
}
