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
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function CurationQueueItem({ asset, collection }: CurationQueueItemProps) {
  const version = getCurrentVersion(asset);
  const metadataMissing = !isMetadataComplete(version.metadata);

  return (
    <Link
      href={`/curation/${asset.id}`}
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-indigo-200 hover:shadow-md sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
    >
      <AssetThumbnail
        src={version.thumbnailPath}
        alt={`Thumbnail for ${asset.name}`}
        type={asset.type}
        className="h-24 w-full shrink-0 sm:h-20 sm:w-28"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{asset.name}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {assetTypeLabel(asset.type)} · v{version.versionNumber}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${priorityStyles[asset.priority]}`}>
              {priorityLabel(asset.priority)} priority
            </span>
            <StatusBadge status={asset.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <QualityScoreDisplay score={version.qualityScore} compact />
          {collection && <Badge color={collection.color}>{collection.name}</Badge>}
          {metadataMissing && (
            <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              Missing metadata
            </span>
          )}
        </div>
      </div>
      <span className="hidden shrink-0 text-sm font-medium text-indigo-600 sm:block dark:text-indigo-400">
        Review →
      </span>
    </Link>
  );
}
