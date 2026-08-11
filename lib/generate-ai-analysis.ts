import type {
  AIAnalysis,
  AIComparisonSummary,
  AIConfidenceLevel,
  AIProductionSuggestion,
  Asset,
  Collection,
} from "@/types";
import { isMetadataComplete, metadataCompleteness } from "@/lib/quality";
import { getCurrentVersion } from "@/lib/utils";

const TYPE_TAG_MAP: Record<Asset["type"], string[]> = {
  image: ["visual", "still"],
  video: ["motion", "clip"],
  audio: ["sound", "audio"],
  "3d": ["3d-asset", "model"],
};

const TYPE_LABEL: Record<Asset["type"], string> = {
  image: "image",
  video: "video",
  audio: "audio",
  "3d": "3D",
};

function deriveConfidence(asset: Asset): AIConfidenceLevel {
  const version = getCurrentVersion(asset);
  const metaComplete = isMetadataComplete(version.metadata);
  const metaScore = metadataCompleteness(version.metadata);

  if (
    metaComplete &&
    asset.tags.length >= 2 &&
    (asset.status === "APPROVED" || asset.status === "PRODUCTION_READY")
  ) {
    return "high";
  }
  if (metaScore >= 60 && asset.tags.length >= 1) {
    return "medium";
  }
  return "low";
}

function deriveProductionSuggestion(asset: Asset): AIAnalysis["productionSuggestion"] {
  const version = getCurrentVersion(asset);
  const metaComplete = isMetadataComplete(version.metadata);

  if (asset.status === "REJECTED") {
    return {
      recommendation: "NOT_RECOMMENDED",
      summary: "Not recommended for production based on current review status.",
      explanation: "Asset status is rejected; curator should archive or regenerate.",
    };
  }

  if (
    asset.status === "PRODUCTION_READY" ||
    (asset.status === "APPROVED" && metaComplete && version.reviewDecision.type === "APPROVED")
  ) {
    return {
      recommendation: "READY_FOR_VERIFICATION",
      summary: "Most production requirements appear satisfied; curator verification recommended.",
      explanation: "Metadata, tags, and review status align with production readiness criteria.",
    };
  }

  return {
    recommendation: "REVIEW_REQUIRED",
    summary: "Production suitability requires human curator review before release.",
    explanation: metaComplete
      ? "Review decision or quality checklist may still be pending."
      : "Metadata completeness should be verified before release.",
  };
}

function suggestTags(asset: Asset, collection: Collection): AIAnalysis["suggestedTags"] {
  const existing = new Set(asset.tags.map((t) => t.toLowerCase()));
  const candidates: { tag: string; explanation: string }[] = [];

  for (const tag of TYPE_TAG_MAP[asset.type]) {
    if (!existing.has(tag)) {
      candidates.push({
        tag,
        explanation: `Suggested because this is a ${TYPE_LABEL[asset.type]} asset type.`,
      });
    }
  }

  const collectionKeyword = collection.name.split(" ")[0]?.toLowerCase();
  if (collectionKeyword && !existing.has(collectionKeyword)) {
    candidates.push({
      tag: collectionKeyword,
      explanation: `Aligns with the "${collection.name}" collection context.`,
    });
  }

  if (asset.isAiGenerated && !existing.has("ai-generated")) {
    candidates.push({
      tag: "ai-generated",
      explanation: "Asset is flagged as AI-generated in metadata.",
    });
  }

  const themeTag = asset.tags[0];
  if (themeTag && !existing.has(`${themeTag}-final`)) {
    candidates.push({
      tag: `${themeTag}-reviewed`,
      explanation: `Extends existing "${themeTag}" tag for post-review classification.`,
    });
  }

  return candidates.slice(0, 4).map((c, i) => ({
    id: `tag-${asset.id}-${i}`,
    tag: c.tag,
    explanation: c.explanation,
  }));
}

function buildObservations(asset: Asset): AIAnalysis["observations"] {
  const version = getCurrentVersion(asset);
  const observations: AIAnalysis["observations"] = [];

  if (!isMetadataComplete(version.metadata)) {
    observations.push({
      id: `obs-${asset.id}-meta`,
      text: "Metadata may be incomplete",
      explanation: "Title, description, or format fields appear missing from metadata records.",
    });
  }

  if (asset.status === "IN_REVIEW" || asset.status === "DRAFT") {
    observations.push({
      id: `obs-${asset.id}-review`,
      text: "Asset appears suitable for curator review",
      explanation: `Current status is ${asset.status.replace("_", " ").toLowerCase()}.`,
    });
  }

  if (asset.versions.length > 1) {
    observations.push({
      id: `obs-${asset.id}-version`,
      text: "Version should be verified",
      explanation: `${asset.versions.length} versions exist; confirm the correct version is selected.`,
    });
  }

  if (asset.collectionId && asset.tags.length > 0) {
    observations.push({
      id: `obs-${asset.id}-consistency`,
      text: "Related assets may need consistency checking",
      explanation: "Collection and tag metadata suggest comparison with related assets.",
    });
  }

  if (asset.status !== "PRODUCTION_READY" && asset.status !== "REJECTED") {
    observations.push({
      id: `obs-${asset.id}-prod`,
      text: "Production suitability requires human review",
      explanation: "AI cannot confirm production readiness; curator checklist applies.",
    });
  }

  return observations;
}

export function generateAIAnalysis(asset: Asset, collections: Collection[]): AIAnalysis {
  const collection = collections.find((c) => c.id === asset.collectionId);
  const collectionName = collection?.name ?? "Unknown collection";
  const version = getCurrentVersion(asset);
  const metaComplete = isMetadataComplete(version.metadata);
  const confidence = deriveConfidence(asset);

  const strengths: string[] = [];
  if (metaComplete) strengths.push("Consistent asset metadata on record");
  strengths.push(`Appropriate ${TYPE_LABEL[asset.type]} asset type for collection context`);
  if (asset.tags.length >= 2) strengths.push("Multiple classification tags present");
  if (version.metadata.generator) strengths.push("Generator source documented in metadata");

  const potentialIssues: string[] = [];
  if (!metaComplete) potentialIssues.push("Metadata fields may need completion");
  if (asset.status === "CHANGES_REQUESTED") {
    potentialIssues.push("Previous curator requested changes — review notes before approval");
  }
  if (version.qualityScore.overall < 70) {
    potentialIssues.push("Quality score suggests closer curator evaluation");
  }
  potentialIssues.push("Review visual consistency with related collection assets");

  const summary = asset.isAiGenerated
    ? `This AI-generated ${TYPE_LABEL[asset.type]} asset in "${collectionName}" may benefit from curator review for composition and collection alignment.`
    : `This ${TYPE_LABEL[asset.type]} asset in "${collectionName}" appears suitable for structured curator review based on existing metadata.`;

  return {
    summary,
    strengths,
    potentialIssues,
    suggestedTags: suggestTags(asset, collection ?? { id: "", name: "General", description: "", color: "" }),
    suggestedCollectionId: asset.collectionId,
    suggestedCollectionExplanation: `Existing asset metadata and tags align with "${collectionName}".`,
    productionSuggestion: deriveProductionSuggestion(asset),
    observations: buildObservations(asset),
    confidence,
    generatedAt: asset.updatedAt,
  };
}

export function generateComparisonSummary(
  assetA: Asset,
  assetB: Asset,
  collections: Collection[],
): AIComparisonSummary {
  const colA = collections.find((c) => c.id === assetA.collectionId)?.name ?? "Unknown";
  const colB = collections.find((c) => c.id === assetB.collectionId)?.name ?? "Unknown";
  const vA = getCurrentVersion(assetA);
  const vB = getCurrentVersion(assetB);

  const assetAStrengths = [
    `Collection alignment: ${colA}`,
    `Metadata ${metadataCompleteness(vA.metadata)}% complete`,
    `Curator score: ${vA.curatorScore ?? vA.qualityScore.overall}`,
  ];
  const assetBStrengths = [
    `Collection alignment: ${colB}`,
    `Metadata ${metadataCompleteness(vB.metadata)}% complete`,
    `Curator score: ${vB.curatorScore ?? vB.qualityScore.overall}`,
  ];

  const keyDifferences: string[] = [];
  if (assetA.type !== assetB.type) {
    keyDifferences.push(`Asset types differ: ${assetA.type} vs ${assetB.type}`);
  }
  if (assetA.collectionId !== assetB.collectionId) {
    keyDifferences.push(`Collections differ: ${colA} vs ${colB}`);
  }
  keyDifferences.push(
    `Quality scores: ${vA.qualityScore.overall} vs ${vB.qualityScore.overall}`,
  );

  const potentialConcerns: string[] = [];
  if (assetA.status === "REJECTED" || assetB.status === "REJECTED") {
    potentialConcerns.push("One or both assets have rejected status");
  }
  potentialConcerns.push("Visual consistency cannot be verified without pixel-level analysis");

  const scoreA = vA.curatorScore ?? vA.qualityScore.overall;
  const scoreB = vB.curatorScore ?? vB.qualityScore.overall;

  let suggestedDirection: string;
  if (scoreA > scoreB + 10) {
    suggestedDirection = `"${assetA.name}" may be stronger for ${colA} based on metadata and score alignment. "${assetB.name}" may suit exploratory use.`;
  } else if (scoreB > scoreA + 10) {
    suggestedDirection = `"${assetB.name}" may be stronger for ${colB} based on metadata and score alignment. "${assetA.name}" may suit exploratory use.`;
  } else {
    suggestedDirection = "Both assets appear comparable; curator judgment should determine the preferred direction.";
  }

  return {
    assetAStrengths,
    assetBStrengths,
    keyDifferences,
    potentialConcerns,
    suggestedDirection,
    explanation: "Derived from existing metadata, tags, and collection records — not pixel analysis.",
  };
}

export function confidenceLabel(level: AIConfidenceLevel): string {
  return { high: "High", medium: "Medium", low: "Low" }[level];
}

export function productionSuggestionLabel(
  rec: AIProductionSuggestion,
): string {
  return {
    READY_FOR_VERIFICATION: "Ready for Verification",
    REVIEW_REQUIRED: "Review Required",
    NOT_RECOMMENDED: "Not Recommended",
  }[rec];
}
