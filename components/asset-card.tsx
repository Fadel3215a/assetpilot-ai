"use client";

import Link from "next/link";
import type { Asset, Collection } from "@/types";
import { assetTypeLabel, getCurrentVersion } from "@/lib/utils";
import { AssetThumbnail } from "./asset-thumbnail";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { QualityScoreDisplay } from "./quality-score-display";

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
  const version = getCurrentVersion(asset);

  const inner = (
    <>
      <AssetThumbnail
        src={version.thumbnailPath}
        alt={`Thumbnail for ${asset.name}`}
        type={asset.type}
        className="aspect-[4/3] w-full"
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
            {asset.name}
          </h3>
          <StatusBadge status={asset.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{assetTypeLabel(asset.type)}</span>
          <span aria-hidden="true">·</span>
          <span>v{version.versionNumber}</span>
          {asset.isSessionUpload && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-600 dark:text-amber-400">Session upload</span>
            </>
          )}
          {collection && (
            <>
              <span aria-hidden="true">·</span>
              <Badge color={collection.color}>{collection.name}</Badge>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {asset.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {tag}
            </span>
          ))}
          {asset.tags.length > 3 && (
            <span className="text-xs text-zinc-400">+{asset.tags.length - 3}</span>
          )}
        </div>

        <QualityScoreDisplay score={version.qualityScore} compact />
      </div>
    </>
  );

  if (bulkMode) {
    return (
      <div
        className={`relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-zinc-900 ${
          selected
            ? "border-indigo-400 ring-2 ring-indigo-200 dark:border-indigo-600 dark:ring-indigo-900"
            : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        <label className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium dark:bg-zinc-900/90">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${asset.name}`}
            className="rounded border-zinc-300"
          />
          Select
        </label>
        <Link href={`/assets/${asset.id}`} className="group flex flex-1 flex-col">
          {inner}
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={`/assets/${asset.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
    >
      {inner}
    </Link>
  );
}
