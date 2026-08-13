import type {
  ActivityItem,
  Asset,
  AssetTimelineEntry,
  CuratorFeedbackEntry,
  DecisionHistoryEntry,
} from "@/types";

export function buildAssetTimeline(
  asset: Asset,
  activity: ActivityItem[],
  feedback: CuratorFeedbackEntry[],
  extraEvents: AssetTimelineEntry[],
): AssetTimelineEntry[] {
  const fromActivity: AssetTimelineEntry[] = activity
    .filter((a) => a.assetId === asset.id)
    .map((a) => ({
      id: a.id,
      assetId: a.assetId,
      timestamp: a.timestamp,
      action: a.action,
      source: a.source,
    }));

  const fromDecisions: AssetTimelineEntry[] = asset.decisionHistory.map((d) => ({
    id: d.id,
    assetId: d.assetId,
    timestamp: d.timestamp,
    action: `Review decision: ${d.decision.replace(/_/g, " ").toLowerCase()} (${d.previousStatus} → ${d.newStatus})`,
    source: "curator" as const,
  }));

  const fromFeedback: AssetTimelineEntry[] = feedback
    .filter((f) => f.assetId === asset.id)
    .map((f) => ({
      id: f.id,
      assetId: f.assetId,
      timestamp: f.timestamp,
      action: `Curator ${f.curatorAction} ${f.suggestionType}: "${f.finalValue ?? f.suggestion}"`,
      source: "curator" as const,
    }));

  const uploadEvent: AssetTimelineEntry[] = asset.isSessionUpload
    ? [
        {
          id: `tl-upload-${asset.id}`,
          assetId: asset.id,
          timestamp: asset.createdAt,
          action: "Asset uploaded (session-only)",
          source: "system",
        },
      ]
    : [];

  return [...extraEvents, ...uploadEvent, ...fromActivity, ...fromDecisions, ...fromFeedback].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function createTimelineEvent(
  assetId: string,
  action: string,
  source: AssetTimelineEntry["source"],
): AssetTimelineEntry {
  return {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    assetId,
    timestamp: new Date().toISOString(),
    action,
    source,
  };
}

export function decisionToTimelineEntry(entry: DecisionHistoryEntry): AssetTimelineEntry {
  return {
    id: entry.id,
    assetId: entry.assetId,
    timestamp: entry.timestamp,
    action: entry.reason
      ? `${entry.decision}: ${entry.reason}`
      : entry.decision.replace(/_/g, " ").toLowerCase(),
    source: "curator",
  };
}
