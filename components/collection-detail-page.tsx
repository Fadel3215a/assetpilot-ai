"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useAssets } from "@/lib/assets-context";
import { AppShell } from "./app-shell";
import { AssetCard } from "./asset-card";
import { EmptyState } from "./empty-state";

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
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Collections", href: "/collections" },
        { label: collection.name },
      ]}
    >
      <div className="space-y-6">
        <Link
          href="/assets"
          className="link-subtle inline-flex font-medium"
        >
          Browse Asset Library <span className="arrow-shift" aria-hidden="true">→</span>
        </Link>

        {colAssets.length === 0 ? (
          <EmptyState
            title="No assets in this collection"
            description="Move assets here from the Asset Library or upload new session-only files."
            actionLabel="Asset Library"
            actionHref="/assets"
          />
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
