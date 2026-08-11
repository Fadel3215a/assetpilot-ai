import type { Asset, AssetStatus } from "@/types";
import {
  calculateCuratorScore,
  createDefaultChecklist,
  hasRequiredTags,
  isMetadataComplete,
} from "@/lib/quality";
import { getCurrentVersion } from "@/lib/utils";

export const PRODUCTION_CRITERIA = [
  { id: "metadata", label: "Metadata complete" },
  { id: "tags", label: "Required tags present" },
  { id: "quality", label: "Quality reviewed" },
  { id: "version", label: "Correct version selected" },
  { id: "consistency", label: "Visual consistency checked" },
  { id: "review", label: "Review decision completed" },
  { id: "issues", label: "No unresolved issues" },
] as const;

export function evaluateProductionCriteria(asset: Asset) {
  const version = getCurrentVersion(asset);
  const checklist = version.curatorChecklist ?? createDefaultChecklist();
  const curatorScore = version.curatorScore ?? calculateCuratorScore(checklist);
  const metadataOk = isMetadataComplete(version.metadata);
  const tagsOk = hasRequiredTags(asset);
  const qualityReviewed = curatorScore > 0 && version.reviewDecision.type !== "PENDING";
  const versionOk = version.isCurrent;
  const consistencyOk =
    checklist.find((c) => c.id === "consistency")?.rating === "PASS" ||
    (curatorScore >= 70 && !checklist.some((c) => c.rating === "FAIL"));
  const reviewDone =
    asset.status === "APPROVED" ||
    asset.status === "PRODUCTION_READY" ||
    version.reviewDecision.type === "APPROVED";
  const noIssues =
    asset.status !== "REJECTED" &&
    asset.status !== "CHANGES_REQUESTED" &&
    !checklist.some((c) => c.rating === "FAIL");

  const items = [
    { id: "metadata", label: "Metadata complete", completed: metadataOk },
    { id: "tags", label: "Required tags present", completed: tagsOk },
    { id: "quality", label: "Quality reviewed", completed: qualityReviewed },
    { id: "version", label: "Correct version selected", completed: versionOk },
    { id: "consistency", label: "Visual consistency checked", completed: consistencyOk },
    { id: "review", label: "Review decision completed", completed: reviewDone },
    { id: "issues", label: "No unresolved issues", completed: noIssues },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const score = Math.round((completedCount / items.length) * 100);
  const ready = completedCount === items.length;

  return { items, score, ready };
}

export function isQueueAsset(status: AssetStatus): boolean {
  return (
    status === "DRAFT" ||
    status === "IN_REVIEW" ||
    status === "CHANGES_REQUESTED"
  );
}

export function comparisonDecisionLabel(decision: string): string {
  const labels: Record<string, string> = {
    PREFER_A: "Prefer A",
    PREFER_B: "Prefer B",
    KEEP_BOTH: "Keep Both",
    REJECT_BOTH: "Reject Both",
  };
  return labels[decision] ?? decision;
}
