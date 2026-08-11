import type { Asset, AssetMetadata, ChecklistRating, QualityCriterion } from "@/types";

export const QUALITY_CRITERIA: { id: string; label: string }[] = [
  { id: "visual", label: "Visual quality" },
  { id: "composition", label: "Composition" },
  { id: "consistency", label: "Consistency" },
  { id: "artifacts", label: "Artifacts" },
  { id: "readability", label: "Readability" },
  { id: "brand", label: "Brand alignment" },
  { id: "production", label: "Production suitability" },
];

const RATING_POINTS: Record<ChecklistRating, number> = {
  PASS: 100,
  NEEDS_REVIEW: 50,
  FAIL: 0,
};

export function createDefaultChecklist(): QualityCriterion[] {
  return QUALITY_CRITERIA.map((c) => ({
    ...c,
    rating: "NEEDS_REVIEW" as ChecklistRating,
  }));
}

export function calculateCuratorScore(checklist: QualityCriterion[]): number {
  if (checklist.length === 0) return 0;
  const total = checklist.reduce((sum, c) => sum + RATING_POINTS[c.rating], 0);
  return Math.round(total / checklist.length);
}

export function ratingLabel(rating: ChecklistRating): string {
  const labels: Record<ChecklistRating, string> = {
    PASS: "Pass",
    NEEDS_REVIEW: "Needs Review",
    FAIL: "Fail",
  };
  return labels[rating];
}

export function deriveChecklistFromScore(overall: number): QualityCriterion[] {
  return QUALITY_CRITERIA.map((c, i) => {
    let rating: ChecklistRating = "NEEDS_REVIEW";
    const threshold = overall - (i % 3) * 5;
    if (threshold >= 80) rating = "PASS";
    else if (threshold < 50) rating = "FAIL";
    return { ...c, rating };
  });
}

export function hasFailingCriteria(checklist: QualityCriterion[]): boolean {
  return checklist.some((c) => c.rating === "FAIL");
}

export function metadataCompleteness(metadata: AssetMetadata): number {
  const fields = [
    metadata.title,
    metadata.description,
    metadata.format,
    metadata.generator,
    metadata.prompt,
  ];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

export function isMetadataComplete(metadata: AssetMetadata): boolean {
  return (
    metadata.title.trim().length > 0 &&
    metadata.description.trim().length > 0 &&
    metadata.format.trim().length > 0
  );
}

export function hasRequiredTags(asset: Asset): boolean {
  return asset.tags.length >= 2;
}

export function priorityLabel(priority: Asset["priority"]): string {
  const labels = { high: "High", medium: "Medium", low: "Low" };
  return labels[priority];
}

export function priorityOrder(priority: Asset["priority"]): number {
  return { high: 0, medium: 1, low: 2 }[priority];
}
