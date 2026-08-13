import type { Asset, AssetHealth, AssetHealthItem } from "@/types";
import { isMetadataComplete, metadataCompleteness } from "@/lib/quality";
import { evaluateProductionCriteria } from "@/lib/production";
import { getCurrentVersion } from "@/lib/utils";

const RECOMMENDED_TAGS = 4;

export function computeAssetHealth(asset: Asset): AssetHealth {
  const version = getCurrentVersion(asset);
  const metaComplete = isMetadataComplete(version.metadata);
  const metaScore = metadataCompleteness(version.metadata);
  const tagCount = asset.tags.length;
  const prod = evaluateProductionCriteria(asset);

  const items: AssetHealthItem[] = [
    {
      id: "metadata",
      label: "Metadata",
      status: metaComplete ? "complete" : metaScore >= 50 ? "partial" : "missing",
      detail: metaComplete ? "Complete" : `${metaScore}% complete`,
    },
    {
      id: "tags",
      label: "Tags",
      status:
        tagCount >= RECOMMENDED_TAGS
          ? "complete"
          : tagCount > 0
            ? "partial"
            : "missing",
      detail: `${tagCount} / ${RECOMMENDED_TAGS}`,
    },
    {
      id: "review",
      label: "Review",
      status:
        asset.status === "APPROVED" || asset.status === "PRODUCTION_READY"
          ? "complete"
          : asset.status === "IN_REVIEW" || asset.status === "DRAFT"
            ? "pending"
            : "partial",
      detail: asset.status.replace(/_/g, " ").toLowerCase(),
    },
    {
      id: "version",
      label: "Version",
      status: version.isCurrent ? "complete" : "partial",
      detail: version.isCurrent ? "Current" : "Not current",
    },
    {
      id: "production",
      label: "Production",
      status: prod.ready ? "complete" : prod.score >= 50 ? "partial" : "pending",
      detail: prod.ready ? "Ready" : "Not ready",
    },
  ];

  const completeCount = items.filter((i) => i.status === "complete").length;

  return {
    items,
    completeCount,
    totalCount: items.length,
  };
}
