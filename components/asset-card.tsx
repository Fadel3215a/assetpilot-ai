"use client";

import Link from "next/link";
import type { Asset, Collection } from "@/types";
import type { VisualGridVariant } from "@/lib/visual-grid";
import { useAssets } from "@/lib/assets-context";
import { assetTypeLabel, getCurrentVersion } from "@/lib/utils";
import { AssetThumbnail } from "./asset-thumbnail";
import { StatusBadge } from "./status-badge";

interface AssetCardProps {
  asset: Asset;
  collection?: Collection;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  variant?: VisualGridVariant;
}

const thumbnailAspect: Record<VisualGridVariant, string> = {
  featured: "aspect-[4/3] w-full sm:aspect-[16/10] lg:min-h-[18rem]",
  wide: "aspect-[21/9] w-full",
  standard: "aspect-[4/3] w-full",
};

export function AssetCard({
  asset,
  collection,
  bulkMode = false,
  selected = false,
  onToggleSelect,
  variant = "standard",
}: AssetCardProps) {
  const { getAssetHealth } = useAssets();
  const version = getCurrentVersion(asset);
  const health = getAssetHealth(asset.id);
  const qualityScore = version.curatorScore ?? version.qualityScore.overall;
  const isFeatured = variant === "featured";

  const inner = (
    <>
      <div className="visual-hover">
        <AssetThumbnail
          src={version.thumbnailPath}
          alt={`Thumbnail for ${asset.name}`}
          type={asset.type}
          className={`${thumbnailAspect[variant]} border-b border-border`}
        />
      </div>
      <div className={`flex flex-1 flex-col gap-2 ${isFeatured ? "p-4" : "p-3"}`}>
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`line-clamp-2 font-semibold text-foreground group-hover:text-accent ${
              isFeatured ? "text-base sm:text-lg" : "text-sm"
            }`}
          >
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
              <span className="text-muted">{collection.name}</span>
            </>
          )}
        </div>

        {!isFeatured && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 opacity-80 transition-opacity group-hover:opacity-100">
            {asset.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="tag-muted">{tag}</span>
            ))}
          </div>
        )}

        {health && health.completeCount < health.totalCount && isFeatured && (
          <p className="text-[11px] text-muted">
            {health.completeCount}/{health.totalCount} health criteria met
          </p>
        )}
      </div>
    </>
  );

  const cardClasses = `group flex h-full flex-col overflow-hidden rounded-md border bg-surface transition-colors ${
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
