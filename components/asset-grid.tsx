"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAssets } from "@/lib/assets-context";
import { defaultAssetFilters, filterAssets } from "@/lib/asset-search";
import { assetHasMetadataIssues } from "@/lib/duplicate-detection";
import { AssetCard } from "./asset-card";
import { AssetFilters } from "./asset-filters";
import { AssetUpload } from "./asset-upload";
import { BulkActionsBar } from "./bulk-actions-bar";
import { EmptyState } from "./empty-state";

export function AssetGrid() {
  const { assets, collections, getDuplicateCandidates } = useAssets();
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");
  const [filters, setFilters] = useState(defaultAssetFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  const filtered = useMemo(() => {
    let result = filterAssets(assets, filters, collections);

    if (focus === "duplicates") {
      result = result.filter((asset) => getDuplicateCandidates(asset.id).length > 0);
    }
    if (focus === "metadata") {
      result = result.filter((asset) => assetHasMetadataIssues(asset, collections));
    }

    return result;
  }, [assets, filters, collections, focus, getDuplicateCandidates]);

  const collectionMap = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const focusLabel =
    focus === "duplicates"
      ? "Showing assets with possible metadata-based duplicates."
      : focus === "metadata"
        ? "Showing assets with metadata or tagging issues."
        : null;

  return (
    <div className="space-y-6">
      <AssetUpload />

      {focusLabel && (
        <p className="rounded-md border border-accent/20 bg-accent-muted px-3 py-2 text-sm text-foreground">
          {focusLabel}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={bulkMode}
            onChange={(e) => {
              setBulkMode(e.target.checked);
              if (!e.target.checked) setSelectedIds([]);
            }}
            className="rounded-sm border-border accent-accent"
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
        <EmptyState
          title="No assets yet"
          description="Upload files above or use Reset demo session in the sidebar to restore seeded assets."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No assets match your search or filters"
          description="Try adjusting search terms, clearing filters, or removing the dashboard focus link."
          actionLabel="Clear filters"
          onAction={() => setFilters(defaultAssetFilters)}
        />
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
