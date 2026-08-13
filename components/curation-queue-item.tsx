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
      className="group flex flex-col overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-accent/30"
    >
      <div className="visual-hover">
        <AssetThumbnail
          src={version.thumbnailPath}
          alt={`Preview for ${asset.name}`}
          type={asset.type}
          className="aspect-[16/10] w-full border-b border-border sm:aspect-[21/9]"
        />
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-accent">
              {asset.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {assetTypeLabel(asset.type)} · v{version.versionNumber}
            </p>
          </div>
          <StatusBadge status={asset.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-sm border px-2 py-0.5 text-[11px] font-medium ${priorityStyles[asset.priority]}`}
          >
            {priorityLabel(asset.priority)} priority
          </span>
          <QualityScoreDisplay score={version.qualityScore} compact />
          {collection && <Badge color={collection.color}>{collection.name}</Badge>}
          {metadataMissing && (
            <span className="rounded-sm border border-status-warning/30 bg-status-warning-muted px-2 py-0.5 text-[11px] font-medium text-status-warning">
              Missing metadata
            </span>
          )}
        </div>

        <span className="inline-block text-sm font-medium text-accent">
          Review →
        </span>
      </div>
    </Link>
  );
}
