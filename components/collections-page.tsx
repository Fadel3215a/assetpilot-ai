"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { getCurrentVersion } from "@/lib/utils";
import { AppShell } from "./app-shell";
import { AssetThumbnail } from "./asset-thumbnail";

export function CollectionsPage() {
  const { collections, assets } = useAssets();

  return (
    <AppShell
      title="Collections"
      description="Visual libraries organizing creative assets by campaign and production stage."
      headerSize="display"
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Collections" },
      ]}
    >
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((col) => {
          const colAssets = assets.filter((a) => a.collectionId === col.id);
          const previewAssets = colAssets.slice(0, 4);

          return (
            <article key={col.id} className="group flex flex-col">
              <Link href={`/collections/${col.id}`} className="block">
                <div className="collection-collage">
                  {Array.from({ length: 4 }, (_, i) => {
                    const asset = previewAssets[i];
                    if (asset) {
                      const version = getCurrentVersion(asset);
                      return (
                        <div key={asset.id} className="collection-collage-cell visual-hover">
                          <AssetThumbnail
                            src={version.thumbnailPath}
                            alt={`Thumbnail for ${asset.name}`}
                            type={asset.type}
                            className="h-full w-full"
                          />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`empty-${col.id}-${i}`}
                        className="collection-collage-cell bg-surface-elevated"
                        aria-hidden="true"
                      />
                    );
                  })}
                </div>
              </Link>

              <div className="mt-4">
                <div
                  className="mb-2 h-1 w-12 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <h3 className="font-semibold text-foreground">{col.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{col.description}</p>
                <p className="mt-2 text-sm text-muted">
                  {colAssets.length} asset{colAssets.length !== 1 ? "s" : ""}
                </p>
                <Link
                  href={`/collections/${col.id}`}
                  className="link-subtle mt-3 inline-block font-medium"
                >
                  Open Collection →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
