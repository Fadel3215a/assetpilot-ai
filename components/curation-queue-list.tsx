"use client";

import { useMemo, useState } from "react";
import { useAssets } from "@/lib/assets-context";
import { priorityOrder } from "@/lib/quality";
import type { AssetStatus, AssetType, QueuePriority } from "@/types";
import { assetTypeLabel, statusLabel } from "@/lib/utils";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { EmptyState } from "./empty-state";
import { CurationQueueItem } from "./curation-queue-item";

type SortOption = "priority" | "quality-asc" | "newest" | "oldest";

export function CurationQueueList() {
  const { getQueueAssets, collections } = useAssets();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<QueuePriority | "all">("all");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [sort, setSort] = useState<SortOption>("priority");

  const queueAssets = getQueueAssets();

  const filtered = useMemo(() => {
    let result = queueAssets.filter((asset) => {
      if (search && !asset.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (priorityFilter !== "all" && asset.priority !== priorityFilter) return false;
      if (typeFilter !== "all" && asset.type !== typeFilter) return false;
      if (statusFilter !== "all" && asset.status !== statusFilter) return false;
      if (collectionFilter !== "all" && asset.collectionId !== collectionFilter) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      const vA = a.versions.find((v) => v.isCurrent)!;
      const vB = b.versions.find((v) => v.isCurrent)!;
      switch (sort) {
        case "priority":
          return priorityOrder(a.priority) - priorityOrder(b.priority);
        case "quality-asc":
          return vA.qualityScore.overall - vB.qualityScore.overall;
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [queueAssets, search, priorityFilter, typeFilter, statusFilter, collectionFilter, sort]);

  const collectionMap = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label htmlFor="queue-search" className="sr-only">Search queue</label>
          <Input
            id="queue-search"
            type="search"
            placeholder="Search queue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as QueuePriority | "all")} aria-label="Filter by priority">
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as AssetType | "all")} aria-label="Filter by type">
            <option value="all">All types</option>
            {(["image", "video", "audio", "3d", "other"] as AssetType[]).map((t) => (
              <option key={t} value={t}>{assetTypeLabel(t)}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AssetStatus | "all")} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {(["DRAFT", "IN_REVIEW", "CHANGES_REQUESTED"] as AssetStatus[]).map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </Select>
          <Select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)} aria-label="Filter by collection">
            <option value="all">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} aria-label="Sort queue">
            <option value="priority">Highest priority</option>
            <option value="quality-asc">Lowest quality score</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted">
        {filtered.length} asset{filtered.length !== 1 ? "s" : ""} awaiting curator review
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          description="No assets match your filters, or all items have been reviewed."
          actionLabel="Asset Library"
          actionHref="/assets"
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((asset) => (
            <li key={asset.id}>
              <CurationQueueItem
                asset={asset}
                collection={collectionMap.get(asset.collectionId)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
