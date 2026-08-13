"use client";

import Link from "next/link";
import type { Asset, Collection } from "@/types";
import { isMetadataComplete, priorityLabel } from "@/lib/quality";
import { assetTypeLabel, getCurrentVersion } from "@/lib/utils";
import { AssetThumbnail } from "./asset-thumbnail";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { QualityScoreDisplay } from "./quality-score-display";

interface CurationQueueItemProps {
  asset: Asset;
  collection?: Collection;
}

const priorityStyles = {
  high: "border-status-danger/30 bg-status-danger-muted text-status-danger",
  medium: "border-status-warning/30 bg-status-warning-muted text-status-warning",
  low: "border-border bg-surface-elevated text-muted",
};

export function CurationQueueItem({ asset, collection }: CurationQueueItemProps) {
  const version = getCurrentVersion(asset);
  const metadataMissing = !isMetadataComplete(version.metadata);

  return (
    <Link
      href={`/curation/${asset.id}`}
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent/30 sm:flex-row sm:items-center"
    >
      <AssetThumbnail
        src={version.thumbnailPath}
        alt={`Thumbnail for ${asset.name}`}
        type={asset.type}
        className="h-24 w-full shrink-0 rounded-sm border border-border sm:h-20 sm:w-28"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">{asset.name}</h3>
            <p className="text-xs text-muted">
              {assetTypeLabel(asset.type)} · v{version.versionNumber}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-sm border px-2 py-0.5 text-[11px] font-medium ${priorityStyles[asset.priority]}`}>
              {priorityLabel(asset.priority)} priority
            </span>
            <StatusBadge status={asset.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <QualityScoreDisplay score={version.qualityScore} compact />
          {collection && <Badge color={collection.color}>{collection.name}</Badge>}
          {metadataMissing && (
            <span className="rounded-sm border border-status-warning/30 bg-status-warning-muted px-2 py-0.5 text-[11px] font-medium text-status-warning">
              Missing metadata
            </span>
          )}
        </div>
      </div>
      <span className="hidden shrink-0 text-sm font-medium text-accent sm:block">
        Review →
      </span>
    </Link>
  );
}
