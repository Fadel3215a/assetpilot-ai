import { QUALITY_CRITERIA, ratingLabel } from "@/lib/quality";
import { formatFileSize } from "@/lib/utils";
import type {
  Asset,
  AssetMetadata,
  AssetVersion,
  ChecklistRating,
  ExtractedExifData,
  ExtractedFileMetadata,
  ProductionReadiness,
  QualityCriterion,
  ReviewDecisionType,
} from "@/types";

export type DiffCategory = "media" | "metadata" | "ai-tags" | "quality" | "readiness";

export type DiffDirection = "increased" | "decreased";

export interface VersionDiffField {
  id: string;
  category: DiffCategory;
  label: string;
  before: string | null;
  after: string | null;
  /** Signed numeric delta (scores, byte sizes) when both sides expose a number. */
  delta?: number;
  direction?: DiffDirection;
}

export interface VersionDiffContext {
  /** Accepted AI tags for this side of the comparison (usually asset.tags). */
  tags?: readonly string[];
  extracted?: ExtractedFileMetadata | null;
  productionReadiness?: ProductionReadiness | null;
}

export interface VersionDiffSide {
  version: AssetVersion;
  context?: VersionDiffContext;
}

export interface AITagDelta {
  added: string[];
  removed: string[];
}

export interface VersionDiffResult {
  identical: boolean;
  totalChanges: number;
  media: VersionDiffField[];
  metadata: VersionDiffField[];
  aiTags: AITagDelta;
  quality: VersionDiffField[];
  readiness: VersionDiffField[];
}

const CHECKLIST_POINTS: Record<ChecklistRating, number> = {
  PASS: 100,
  NEEDS_REVIEW: 50,
  FAIL: 0,
};

const QUALITY_SUBMETRICS: { key: keyof NonNullable<AssetVersion["qualityScore"]>; label: string }[] =
  [
    { key: "overall", label: "Quality score" },
    { key: "visualClarity", label: "Quality · Visual clarity" },
    { key: "consistency", label: "Quality · Consistency" },
    { key: "technicalQuality", label: "Quality · Technical quality" },
    { key: "brandAlignment", label: "Quality · Brand alignment" },
  ];

const EXIF_TAGS: { key: keyof ExtractedExifData; label: string; format?: (v: number) => string }[] =
  [
    { key: "make", label: "EXIF · Camera make" },
    { key: "model", label: "EXIF · Camera model" },
    { key: "dateTime", label: "EXIF · Date taken" },
    { key: "dateTimeOriginal", label: "EXIF · Date taken (original)" },
    { key: "iso", label: "EXIF · ISO", format: (v) => `${v}` },
    { key: "fNumber", label: "EXIF · Aperture", format: (v) => `f/${v}` },
    { key: "exposureTime", label: "EXIF · Exposure", format: (v) => `${v}s` },
    { key: "focalLengthIn35mm", label: "EXIF · Focal length (35mm)", format: (v) => `${v}mm` },
    { key: "lensModel", label: "EXIF · Lens" },
    { key: "orientation", label: "EXIF · Orientation", format: orientationLabel },
  ];

const EXTRACTED_FIELDS: {
  key: keyof Pick<
    ExtractedFileMetadata,
    "aspectRatio" | "colorSpace" | "hasAlpha" | "bitDepth" | "iccProfile"
  >;
  label: string;
  format: (v: number | string | boolean) => string;
}[] = [
  { key: "colorSpace", label: "EXIF · Color space", format: (v) => `${v}` },
  { key: "iccProfile", label: "EXIF · ICC profile", format: (v) => `${v}` },
  { key: "hasAlpha", label: "EXIF · Alpha channel", format: (v) => (v ? "Yes" : "No") },
  { key: "bitDepth", label: "EXIF · Bit depth", format: (v) => `${v} bpc` },
  { key: "aspectRatio", label: "EXIF · Aspect ratio", format: (v) =>
    typeof v === "number" ? v.toFixed(3) : `${v}`,
  },
];

const ORIENTATION_LABELS: Record<number, string> = {
  1: "Normal",
  2: "Mirrored",
  3: "Rotated 180°",
  4: "Mirrored + rotated 180°",
  5: "Mirrored + rotated 90°",
  6: "Rotated 90° CW",
  7: "Mirrored + rotated 270°",
  8: "Rotated 270° CW",
};

function orientationLabel(value: number): string {
  return ORIENTATION_LABELS[value] ?? `Orientation ${value}`;
}

function diffStringField(
  category: DiffCategory,
  id: string,
  label: string,
  before: string | number | boolean | null | undefined,
  after: string | number | boolean | null | undefined,
): VersionDiffField[] {
  const normalized = (v: string | number | boolean | null | undefined): string | null => {
    if (v === null || v === undefined || v === "") return null;
    return `${v}`;
  };
  const b = normalized(before);
  const c = normalized(after);
  if (b === c) return [];
  return [{ id, category, label, before: b, after: c }];
}

function diffScoreField(
  category: DiffCategory,
  id: string,
  label: string,
  before: number | null | undefined,
  after: number | null | undefined,
): VersionDiffField[] {
  const b = before ?? null;
  const c = after ?? null;
  if (b === c) return [];
  const delta = b !== null && c !== null ? c - b : undefined;
  const direction: DiffDirection =
    b === null ? "increased" : c === null ? "decreased" : c! > b! ? "increased" : "decreased";
  return [
    {
      id,
      category,
      label,
      before: b === null ? null : `${b}`,
      after: c === null ? null : `${c}`,
      delta,
      direction,
    },
  ];
}

function diffMedia(a: AssetMetadata, b: AssetMetadata): VersionDiffField[] {
  const fields: VersionDiffField[] = [];

  fields.push(...diffStringField("media", "media.dimensions", "Dimensions",
    a.dimensions ? `${a.dimensions.width} × ${a.dimensions.height}` : null,
    b.dimensions ? `${b.dimensions.width} × ${b.dimensions.height}` : null));

  if (a.fileSize !== b.fileSize) {
    fields.push({
      id: "media.fileSize",
      category: "media",
      label: "File size",
      before: formatFileSize(a.fileSize),
      after: formatFileSize(b.fileSize),
      delta: b.fileSize - a.fileSize,
      direction: b.fileSize > a.fileSize ? "increased" : "decreased",
    });
  }

  fields.push(
    ...diffScoreField("media", "media.duration", "Duration", a.duration, b.duration).map((f) => ({
      ...f,
      before: f.before === null ? null : `${f.before}s`,
      after: f.after === null ? null : `${f.after}s`,
      delta: undefined,
      direction: undefined,
    })),
  );

  fields.push(...diffStringField("media", "media.format", "Format", a.format, b.format));
  fields.push(...diffStringField("media", "media.mimeType", "MIME type", a.mimeType, b.mimeType));
  fields.push(...diffStringField("media", "media.fileName", "File name", a.fileName, b.fileName));

  return fields;
}

function diffMetadata(a: VersionDiffSide, b: VersionDiffSide): VersionDiffField[] {
  const aMeta = a.version.metadata;
  const bMeta = b.version.metadata;
  const fields: VersionDiffField[] = [];

  fields.push(...diffStringField("metadata", "metadata.label", "Label", a.version.label, b.version.label));
  fields.push(...diffStringField("metadata", "metadata.title", "Title", aMeta.title, bMeta.title));
  fields.push(...diffStringField("metadata", "metadata.description", "Description", aMeta.description, bMeta.description));
  fields.push(...diffStringField("metadata", "metadata.prompt", "Prompt", aMeta.prompt, bMeta.prompt));
  fields.push(...diffStringField("metadata", "metadata.generator", "Generator", aMeta.generator, bMeta.generator));

  const aExtracted = a.context?.extracted;
  const bExtracted = b.context?.extracted;

  for (const tag of EXIF_TAGS) {
    const before = tag.format ? formatExif(aExtracted?.exif?.[tag.key], tag) : `${aExtracted?.exif?.[tag.key] ?? ""}`;
    const after = tag.format ? formatExif(bExtracted?.exif?.[tag.key], tag) : `${bExtracted?.exif?.[tag.key] ?? ""}`;
    fields.push(...diffStringField("metadata", `metadata.exif.${tag.key}`, tag.label, before, after));
  }

  for (const field of EXTRACTED_FIELDS) {
    const before = formatExtracted(aExtracted?.[field.key], field);
    const after = formatExtracted(bExtracted?.[field.key], field);
    fields.push(...diffStringField("metadata", `metadata.extracted.${field.key}`, field.label, before, after));
  }

  return fields;
}

function formatExif(value: unknown, tag: { format?: (v: number) => string }): string {
  if (value === undefined || value === null) return "";
  return tag.format && typeof value === "number" ? tag.format(value) : `${value}`;
}

function formatExtracted(
  value: number | string | boolean | null | undefined,
  field: { format: (v: number | string | boolean) => string },
): string {
  if (value === undefined || value === null) return "";
  return field.format(value);
}

function diffQuality(a: AssetVersion, b: AssetVersion): VersionDiffField[] {
  const fields: VersionDiffField[] = [];

  for (const metric of QUALITY_SUBMETRICS) {
    fields.push(
      ...diffScoreField(
        "quality",
        `quality.${metric.key}`,
        metric.label,
        a.qualityScore[metric.key] as number | undefined,
        b.qualityScore[metric.key] as number | undefined,
      ),
    );
  }

  fields.push(
    ...diffScoreField("quality", "quality.curatorScore", "Curator score", a.curatorScore, b.curatorScore),
  );

  fields.push(
    ...diffStringField(
      "quality",
      "quality.reviewDecision",
      "Review decision",
      reviewDecisionLabel(a.reviewDecision.type),
      reviewDecisionLabel(b.reviewDecision.type),
    ),
  );

  fields.push(...diffChecklist(a.curatorChecklist, b.curatorChecklist));

  return fields;
}

function reviewDecisionLabel(decision: ReviewDecisionType): string {
  const labels: Record<ReviewDecisionType, string> = {
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CHANGES_REQUESTED: "Changes requested",
    PENDING: "Pending",
  };
  return labels[decision] ?? decision;
}

function diffChecklist(
  a: QualityCriterion[] | null | undefined,
  b: QualityCriterion[] | null | undefined,
): VersionDiffField[] {
  if (!a && !b) return [];
  const aMap = new Map((a ?? []).map((c) => [c.id, c.rating]));
  const bMap = new Map((b ?? []).map((c) => [c.id, c.rating]));
  const ids = Array.from(new Set([...aMap.keys(), ...bMap.keys()]));
  const fields: VersionDiffField[] = [];

  for (const id of ids) {
    const ra = aMap.get(id);
    const rb = bMap.get(id);
    if (ra === rb) continue;
    const label = QUALITY_CRITERIA.find((c) => c.id === id)?.label ?? id;
    const delta =
      ra !== undefined && rb !== undefined
        ? CHECKLIST_POINTS[rb] - CHECKLIST_POINTS[ra]
        : undefined;
    const direction: DiffDirection =
      ra === undefined ? "increased" : rb === undefined ? "decreased" : delta! > 0 ? "increased" : "decreased";
    fields.push({
      id: `quality.checklist.${id}`,
      category: "quality",
      label: `Checklist · ${label}`,
      before: ra !== undefined ? ratingLabel(ra) : null,
      after: rb !== undefined ? ratingLabel(rb) : null,
      delta,
      direction,
    });
  }

  return fields;
}

function diffReadiness(
  a: VersionDiffContext | undefined,
  b: VersionDiffContext | undefined,
): VersionDiffField[] {
  const aPr = a?.productionReadiness;
  const bPr = b?.productionReadiness;
  if (!aPr && !bPr) return [];
  const fields: VersionDiffField[] = [];

  fields.push(
    ...diffScoreField(
      "readiness",
      "readiness.score",
      "Production readiness",
      aPr?.score,
      bPr?.score,
    ),
  );

  const aMap = new Map((aPr?.checklist ?? []).map((c) => [c.id, c.completed]));
  const bMap = new Map((bPr?.checklist ?? []).map((c) => [c.id, c.completed]));
  const ids = Array.from(new Set([...aMap.keys(), ...bMap.keys()]));

  for (const id of ids) {
    const ra = aMap.get(id);
    const rb = bMap.get(id);
    if (ra === rb) continue;
    fields.push({
      id: `readiness.checklist.${id}`,
      category: "readiness",
      label: `Readiness · ${labelForChecklistId(id)}`,
      before: ra === undefined ? null : ra ? "Complete" : "Pending",
      after: rb === undefined ? null : rb ? "Complete" : "Pending",
      delta: undefined,
      direction: ra === false && rb === true ? "increased" : ra === true && rb === false ? "decreased" : undefined,
    });
  }

  return fields;
}

function labelForChecklistId(id: string): string {
  const labels: Record<string, string> = {
    metadata: "Metadata complete",
    tags: "Required tags present",
    quality: "Quality reviewed",
    version: "Correct version selected",
    consistency: "Visual consistency checked",
    review: "Review decision completed",
    issues: "No unresolved issues",
  };
  return labels[id] ?? id;
}

function diffAITags(
  a: VersionDiffContext | undefined,
  b: VersionDiffContext | undefined,
): AITagDelta {
  const aTags = a?.tags ?? [];
  const bTags = b?.tags ?? [];
  return {
    added: bTags.filter((t) => !aTags.includes(t)),
    removed: aTags.filter((t) => !bTags.includes(t)),
  };
}

export function computeVersionDiff(a: VersionDiffSide, b: VersionDiffSide): VersionDiffResult {
  const media = diffMedia(a.version.metadata, b.version.metadata);
  const metadata = diffMetadata(a, b);
  const quality = diffQuality(a.version, b.version);
  const readiness = diffReadiness(a.context, b.context);
  const aiTags = diffAITags(a.context, b.context);

  const totalChanges =
    media.length +
    metadata.length +
    quality.length +
    readiness.length +
    aiTags.added.length +
    aiTags.removed.length;

  return {
    identical: totalChanges === 0,
    totalChanges,
    media,
    metadata,
    aiTags,
    quality,
    readiness,
  };
}

export function buildVersionDiffSide(version: AssetVersion, asset: Asset): VersionDiffSide {
  return {
    version,
    context: {
      tags: asset.tags,
      extracted: asset.extractedMetadata,
      productionReadiness: asset.productionReadiness,
    },
  };
}