"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { isQueueAsset } from "@/lib/production";
import { assetTypeLabel, getCurrentVersion } from "@/lib/utils";
import { AssetThumbnail } from "./asset-thumbnail";
import { StatusBadge } from "./status-badge";

export function DashboardFeaturedWorkspace() {
  const { assets, collections } = useAssets();

  const featured =
    assets.find((a) => isQueueAsset(a.status)) ??
    assets.find((a) => a.status === "PRODUCTION_READY") ??
    assets[0];

  if (!featured) {
    return (
      <div className="rounded-md border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted">No assets in workspace yet.</p>
        <Link href="/assets" className="mt-2 inline-block text-sm text-accent hover:underline">
          Open Asset Library
        </Link>
      </div>
    );
  }

  const version = getCurrentVersion(featured);
  const collection = collections.find((c) => c.id === featured.collectionId);
  const qualityScore = version.curatorScore ?? version.qualityScore.overall;

  const supporting = assets
    .filter((a) => a.id !== featured.id)
    .slice(0, 3);

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <Link
        href={`/assets/${featured.id}`}
        className="group visual-hover relative overflow-hidden rounded-md border border-border transition-[transform,border-color,box-shadow] duration-[var(--duration-normal)] ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_16px_40px_-20px_rgba(0,245,160,0.18)] motion-reduce:transition-none motion-reduce:transform-none lg:col-span-8"
      >
        <AssetThumbnail
          src={version.thumbnailPath}
          alt={featured.name}
          type={featured.type}
          className="aspect-[16/10] w-full sm:aspect-[16/9] lg:aspect-auto lg:min-h-[22rem]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent px-5 py-5">
          <StatusBadge status={featured.status} />
          <h3 className="mt-2 text-xl font-semibold text-foreground group-hover:text-accent sm:text-2xl">
            {featured.name}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {assetTypeLabel(featured.type)}
            {collection && ` · ${collection.name}`}
            {` · Q${qualityScore}`}
          </p>
        </div>
      </Link>

      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-1">
        {supporting.map((asset) => {
          const v = getCurrentVersion(asset);
          return (
            <Link
              key={asset.id}
              href={`/assets/${asset.id}`}
              className="group visual-hover overflow-hidden rounded-md border border-border transition-[transform,border-color,box-shadow] duration-[var(--duration-normal)] ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[0_12px_28px_-16px_rgba(0,0,0,0.7)] motion-reduce:transition-none motion-reduce:transform-none"
            >
              <AssetThumbnail
                src={v.thumbnailPath}
                alt={asset.name}
                type={asset.type}
                className="aspect-[4/3] w-full lg:aspect-[16/10]"
              />
              <div className="border-t border-border px-3 py-2.5">
                <p className="truncate text-sm font-medium text-foreground group-hover:text-accent">
                  {asset.name}
                </p>
                <p className="text-xs text-muted">{assetTypeLabel(asset.type)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
