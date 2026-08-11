"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useAssets } from "@/lib/assets-context";
import { AppShell } from "./app-shell";
import { AssetCard } from "./asset-card";

export function CollectionDetailPage({ collectionId }: { collectionId: string }) {
  const { collections, assets } = useAssets();
  const collection = collections.find((c) => c.id === collectionId);

  if (!collection) {
    notFound();
  }

  const colAssets = assets.filter((a) => a.collectionId === collectionId);

  return (
    <AppShell
      title={collection.name}
      description={collection.description}
    >
      <div className="space-y-6">
        <Link
          href="/collections"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          ← All collections
        </Link>
        {colAssets.length === 0 ? (
          <p className="text-sm text-zinc-500">No assets in this collection.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {colAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} collection={collection} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
