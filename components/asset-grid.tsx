"use client";

import { useMemo, useState } from "react";
import { useAssets } from "@/lib/assets-context";
import { defaultAssetFilters, filterAssets } from "@/lib/asset-search";
import { AssetCard } from "./asset-card";
import { AssetFilters } from "./asset-filters";
import { AssetUpload } from "./asset-upload";
import { BulkActionsBar } from "./bulk-actions-bar";

export function AssetGrid() {
  const { assets, collections } = useAssets();
  const [filters, setFilters] = useState(defaultAssetFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  const filtered = useMemo(
    () => filterAssets(assets, filters, collections),
    [assets, filters, collections],
  );

  const collectionMap = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <AssetUpload />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={bulkMode}
            onChange={(e) => {
              setBulkMode(e.target.checked);
              if (!e.target.checked) setSelectedIds([]);
            }}
            className="rounded border-zinc-300"
          />
          Bulk select mode
        </label>
      </div>

      {bulkMode && (
        <BulkActionsBar
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
        />
      )}

      <AssetFilters
        filters={filters}
        onFiltersChange={setFilters}
        collections={collections}
        resultCount={filtered.length}
        totalCount={assets.length}
      />

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No assets yet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Upload files above or refresh to restore seeded demo assets.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            No assets match your search or filters
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
              bulkMode={bulkMode}
              selected={selectedIds.includes(asset.id)}
              onToggleSelect={() => toggleSelect(asset.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
