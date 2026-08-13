import { getAIAnalysisProvider } from "@/lib/ai";
import { createDefaultChecklist } from "@/lib/quality";
import { evaluateProductionCriteria } from "@/lib/production";
import type {
  Asset,
  AssetStatus,
  AssetType,
  Collection,
  ExtractedFileMetadata,
} from "@/types";

const baseChecklist = [
  { id: "meta", label: "Metadata complete", completed: false },
  { id: "quality", label: "Quality threshold met", completed: false },
  { id: "review", label: "Curator review approved", completed: false },
  { id: "format", label: "Export format verified", completed: false },
  { id: "rights", label: "Usage notes documented", completed: false },
];

export function buildUploadedAsset(
  extracted: ExtractedFileMetadata,
  type: AssetType,
  objectUrl: string,
  collectionId: string,
  collections: Collection[],
): Asset {
  const now = new Date().toISOString();
  const id = `asset-upload-${Date.now()}`;
  const versionId = `ver-${id}-1`;
  const name = extracted.fileName.replace(/\.[^.]+$/, "") || extracted.fileName;

  const metadata = {
    title: name,
    description: `Session-uploaded ${type} asset.`,
    format: extracted.extension.toUpperCase() || "UNKNOWN",
    fileSize: extracted.fileSize,
    fileName: extracted.fileName,
    mimeType: extracted.mimeType,
    dimensions: extracted.dimensions,
    duration: extracted.duration,
    createdAt: now,
    updatedAt: now,
  };

  const version = {
    id: versionId,
    versionNumber: 1,
    label: "Initial upload",
    thumbnailPath: objectUrl,
    previewPath: objectUrl,
    mediaUrl: objectUrl,
    metadata,
    qualityScore: { overall: 0 },
    reviewDecision: {
      type: "PENDING" as const,
      reviewer: "Alex Chen",
      decidedAt: now,
    },
    curatorChecklist: createDefaultChecklist(),
    curatorScore: 0,
    createdAt: now,
    isCurrent: true,
  };

  const asset: Asset = {
    id,
    name,
    type,
    status: "DRAFT" as AssetStatus,
    collectionId,
    tags: ["uploaded", type === "other" ? "file" : type],
    isAiGenerated: false,
    priority: "medium",
    currentVersionId: versionId,
    versions: [version],
    productionReadiness: {
      score: 0,
      checklist: baseChecklist.map((item) => ({ ...item })),
    },
    decisionHistory: [],
    usageNotes: "",
    extractedMetadata: extracted,
    isSessionUpload: true,
    createdAt: now,
    updatedAt: now,
    aiAnalysis: { summary: "", strengths: [], potentialIssues: [], suggestedTags: [], suggestedCollectionId: collectionId, suggestedCollectionExplanation: "", productionSuggestion: { recommendation: "REVIEW_REQUIRED", summary: "", explanation: "" }, observations: [], confidence: "low", generatedAt: now },
  };

  const prod = evaluateProductionCriteria(asset);
  asset.productionReadiness = {
    score: prod.score,
    checklist: prod.items.map((i) => ({ id: i.id, label: i.label, completed: i.completed })),
  };

  asset.aiAnalysis = getAIAnalysisProvider().analyze(asset, collections);

  return asset;
}

export function buildNewVersion(
  asset: Asset,
  objectUrl: string | null,
  extracted: ExtractedFileMetadata | null,
  label: string,
): Asset {
  const now = new Date().toISOString();
  const current = asset.versions.find((v) => v.isCurrent)!;
  const nextNumber = Math.max(...asset.versions.map((v) => v.versionNumber)) + 1;
  const versionId = `ver-${asset.id}-${nextNumber}`;

  const previewPath = objectUrl ?? current.previewPath;
  const metadata = extracted
    ? {
        title: `${asset.name} v${nextNumber}`,
        description: current.metadata.description,
        format: extracted.extension.toUpperCase() || current.metadata.format,
        fileSize: extracted.fileSize,
        fileName: extracted.fileName,
        mimeType: extracted.mimeType,
        dimensions: extracted.dimensions ?? current.metadata.dimensions,
        duration: extracted.duration ?? current.metadata.duration,
        createdAt: now,
        updatedAt: now,
      }
    : { ...current.metadata, title: `${asset.name} v${nextNumber}`, updatedAt: now };

  const newVersion = {
    id: versionId,
    versionNumber: nextNumber,
    label,
    thumbnailPath: previewPath,
    previewPath,
    mediaUrl: objectUrl ?? current.mediaUrl,
    metadata,
    qualityScore: { ...current.qualityScore },
    reviewDecision: {
      type: "PENDING" as const,
      reviewer: "Alex Chen",
      decidedAt: now,
    },
    curatorChecklist: createDefaultChecklist(),
    curatorScore: 0,
    createdAt: now,
    isCurrent: true,
  };

  const versions = asset.versions.map((v) => ({ ...v, isCurrent: false }));
  versions.push(newVersion);

  return {
    ...asset,
    currentVersionId: versionId,
    versions,
    status: "IN_REVIEW",
    updatedAt: now,
    extractedMetadata: extracted ?? asset.extractedMetadata,
  };
}
