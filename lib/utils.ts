import type { Asset, AssetStatus, AssetVersion, ReviewDecisionType } from "@/types";

export function getCurrentVersion(asset: Asset): AssetVersion {
  const version = asset.versions.find((v) => v.id === asset.currentVersionId);
  if (!version) {
    throw new Error(`Current version not found for asset ${asset.id}`);
  }
  return version;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function statusFromDecision(decision: ReviewDecisionType): AssetStatus {
  switch (decision) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "CHANGES_REQUESTED":
      return "CHANGES_REQUESTED";
    case "PENDING":
      return "IN_REVIEW";
  }
}

export function assetTypeLabel(type: Asset["type"]): string {
  const labels: Record<Asset["type"], string> = {
    image: "Image",
    video: "Video",
    audio: "Audio",
    "3d": "3D Model",
  };
  return labels[type];
}

export function statusLabel(status: AssetStatus): string {
  const labels: Record<AssetStatus, string> = {
    DRAFT: "Draft",
    IN_REVIEW: "In Review",
    CHANGES_REQUESTED: "Changes Requested",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    PRODUCTION_READY: "Production Ready",
  };
  return labels[status];
}

export function countByStatus(assets: Asset[], status: AssetStatus): number {
  return assets.filter((a) => a.status === status).length;
}

/** Pick a deterministic comparison partner: same collection first, else first different asset. */
export function findComparisonPartner(
  assets: Pick<Asset, "id" | "collectionId">[],
  assetId: string,
): string | null {
  const others = assets.filter((a) => a.id !== assetId);
  if (others.length === 0) return null;

  const source = assets.find((a) => a.id === assetId);
  if (source) {
    const sameCollection = others.find((a) => a.collectionId === source.collectionId);
    if (sameCollection) return sameCollection.id;
  }

  return others[0]?.id ?? null;
}
