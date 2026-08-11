import type { Asset, AssetStatus, DecisionHistoryEntry, QueuePriority } from "@/types";
import { deriveChecklistFromScore } from "@/lib/quality";
import { PRODUCTION_CRITERIA, evaluateProductionCriteria } from "@/lib/production";

type RawAsset = Omit<Asset, "priority" | "decisionHistory">;

const priorities: Record<string, QueuePriority> = {
  "asset-001": "low",
  "asset-002": "high",
  "asset-003": "low",
  "asset-004": "low",
  "asset-005": "high",
  "asset-006": "medium",
  "asset-007": "low",
  "asset-008": "medium",
  "asset-009": "low",
  "asset-010": "low",
  "asset-011": "medium",
  "asset-012": "low",
};

function seedDecisionHistory(asset: RawAsset): DecisionHistoryEntry[] {
  const entries: DecisionHistoryEntry[] = [];

  for (const version of asset.versions) {
    const decision = version.reviewDecision;
    if (decision.type === "PENDING") continue;

    let previousStatus: AssetStatus = "DRAFT";
    if (decision.type === "APPROVED") previousStatus = "IN_REVIEW";
    if (decision.type === "REJECTED") previousStatus = "IN_REVIEW";
    if (decision.type === "CHANGES_REQUESTED") previousStatus = "IN_REVIEW";

    entries.push({
      id: `dh-${asset.id}-${version.id}`,
      assetId: asset.id,
      timestamp: decision.decidedAt,
      reviewer: decision.reviewer,
      previousStatus,
      newStatus:
        decision.type === "APPROVED"
          ? "APPROVED"
          : decision.type === "REJECTED"
            ? "REJECTED"
            : "CHANGES_REQUESTED",
      decision: decision.type,
      reason: decision.notes,
      curatorScore: version.qualityScore.overall,
    });
  }

  if (asset.status === "PRODUCTION_READY") {
    entries.push({
      id: `dh-${asset.id}-prod`,
      assetId: asset.id,
      timestamp: asset.updatedAt,
      reviewer: "Alex Chen",
      previousStatus: "APPROVED",
      newStatus: "PRODUCTION_READY",
      decision: "APPROVED",
      reason: "All production readiness criteria met.",
      curatorScore: getCurrentScore(asset),
    });
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function getCurrentScore(asset: RawAsset): number {
  const current = asset.versions.find((v) => v.isCurrent);
  return current?.qualityScore.overall ?? 0;
}

export function enrichMockAssets(rawAssets: RawAsset[]): Asset[] {
  return rawAssets.map((asset) => {
    const versions = asset.versions.map((v) => {
      if (!v.isCurrent) return v;
      const checklist = deriveChecklistFromScore(v.qualityScore.overall);
      const curatorScore = Math.round(
        checklist.reduce((sum, c) => {
          const pts = c.rating === "PASS" ? 100 : c.rating === "NEEDS_REVIEW" ? 50 : 0;
          return sum + pts;
        }, 0) / checklist.length,
      );
      return { ...v, curatorChecklist: checklist, curatorScore };
    });

    const enriched: Asset = {
      ...asset,
      versions,
      priority: priorities[asset.id] ?? "medium",
      decisionHistory: seedDecisionHistory({ ...asset, versions }),
    };

    const prod = evaluateProductionCriteria(enriched);
    enriched.productionReadiness = {
      score: prod.score,
      checklist: prod.items.map((i) => ({
        id: i.id,
        label: i.label,
        completed: i.completed,
      })),
      readyAt: prod.ready ? enriched.updatedAt : undefined,
    };

    return enriched;
  });
}

export { PRODUCTION_CRITERIA };
