"use client";

import { useMemo, useState } from "react";
import { useAssets } from "@/lib/assets-context";
import type { AssetStatus, AssetType } from "@/types";
import { AssetCard } from "./asset-card";
import { AssetFilters } from "./asset-filters";

export function AssetGrid() {
  const { assets, collections } = useAssets();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      if (search && !asset.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (typeFilter !== "all" && asset.type !== typeFilter) return false;
      if (statusFilter !== "all" && asset.status !== statusFilter) return false;
      if (collectionFilter !== "all" && asset.collectionId !== collectionFilter) {
        return false;
      }
      return true;
    });
  }, [assets, search, typeFilter, statusFilter, collectionFilter]);

  const collectionMap = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  );

  return (
    <div className="space-y-6">
      <AssetFilters
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        collectionFilter={collectionFilter}
        onCollectionChange={setCollectionFilter}
        collections={collections}
        resultCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            No assets match your filters
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Try adjusting search or filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              collection={collectionMap.get(asset.collectionId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
