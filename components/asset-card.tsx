"use client";

import Link from "next/link";
import type { Asset, Collection } from "@/types";
import { useAssets } from "@/lib/assets-context";
import { assetTypeLabel, getCurrentVersion } from "@/lib/utils";
import { AssetThumbnail } from "./asset-thumbnail";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";

interface AssetCardProps {
  asset: Asset;
  collection?: Collection;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function AssetCard({
  asset,
  collection,
  bulkMode = false,
  selected = false,
  onToggleSelect,
}: AssetCardProps) {
  const { getAssetHealth } = useAssets();
  const version = getCurrentVersion(asset);
  const health = getAssetHealth(asset.id);
  const qualityScore = version.curatorScore ?? version.qualityScore.overall;
  const healthSummary =
    health && health.completeCount < health.totalCount
      ? `${health.completeCount}/${health.totalCount} health criteria met`
      : health
        ? "Health complete"
        : null;

  const inner = (
    <>
      <AssetThumbnail
        src={version.thumbnailPath}
        alt={`Thumbnail for ${asset.name}`}
        type={asset.type}
        className="aspect-[4/3] w-full border-b border-border"
      />
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-accent">
            {asset.name}
          </h3>
          <StatusBadge status={asset.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted">{assetTypeLabel(asset.type)}</span>
          <span className="text-border" aria-hidden="true">·</span>
          <span className="font-medium text-foreground">Q{qualityScore}</span>
          {collection && (
            <>
              <span className="text-border" aria-hidden="true">·</span>
              <Badge color={collection.color} className="text-[10px]">{collection.name}</Badge>
            </>
          )}
          {asset.isSessionUpload && (
            <>
              <span className="text-border" aria-hidden="true">·</span>
              <span className="text-status-warning">Session</span>
            </>
          )}
        </div>

        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag-muted">
                {tag}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span className="text-[11px] text-muted">+{asset.tags.length - 3}</span>
            )}
          </div>
        )}

        {healthSummary && (
          <p className="text-[11px] text-muted">{healthSummary}</p>
        )}
      </div>
    </>
  );

  const cardClasses = `group flex flex-col overflow-hidden rounded-md border bg-surface transition-colors ${
    selected
      ? "border-accent ring-1 ring-accent/30"
      : "border-border hover:border-accent/30"
  }`;

  if (bulkMode) {
    return (
      <div className={`relative ${cardClasses}`}>
        <label className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-sm border border-border bg-surface/95 px-2 py-1 text-[11px] font-medium text-foreground">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${asset.name}`}
            className="rounded-sm border-border accent-accent"
          />
          Select
        </label>
        <Link href={`/assets/${asset.id}`} className="flex flex-1 flex-col">
          {inner}
        </Link>
      </div>
    );
  }

  return (
    <Link href={`/assets/${asset.id}`} className={cardClasses}>
      {inner}
    </Link>
  );
}
