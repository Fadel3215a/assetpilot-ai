import type { Asset, AssetFilterState, AssetStatus, AssetType, Collection } from "@/types";
import { evaluateProductionCriteria } from "@/lib/production";
import { getCurrentVersion } from "@/lib/utils";

export function assetMatchesSearch(
  asset: Asset,
  search: string,
  collections: Collection[],
): boolean {
  if (!search.trim()) return true;

  const q = search.toLowerCase();
  const version = getCurrentVersion(asset);
  const collection = collections.find((c) => c.id === asset.collectionId);

  const haystack = [
    asset.name,
    version.metadata.description,
    version.metadata.title,
    asset.type,
    asset.status,
    collection?.name ?? "",
    ...asset.tags,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export function assetMatchesFilters(
  asset: Asset,
  filters: AssetFilterState,
  collections: Collection[],
): boolean {
  if (!assetMatchesSearch(asset, filters.search, collections)) return false;

  if (filters.type !== "all" && asset.type !== filters.type) return false;
  if (filters.status !== "all" && asset.status !== filters.status) return false;
  if (filters.collection !== "all" && asset.collectionId !== filters.collection) return false;
  if (filters.priority !== "all" && asset.priority !== filters.priority) return false;

  if (filters.minQuality !== "all") {
    const min = Number(filters.minQuality);
    const score = getCurrentVersion(asset).curatorScore ?? getCurrentVersion(asset).qualityScore.overall;
    if (score < min) return false;
  }

  if (filters.productionReady !== "all") {
    const ready = evaluateProductionCriteria(asset).ready;
    if (filters.productionReady === "ready" && !ready) return false;
    if (filters.productionReady === "not-ready" && ready) return false;
  }

  return true;
}

export function filterAssets(
  assets: Asset[],
  filters: AssetFilterState,
  collections: Collection[],
): Asset[] {
  return assets.filter((a) => assetMatchesFilters(a, filters, collections));
}

export const defaultAssetFilters: AssetFilterState = {
  search: "",
  type: "all",
  status: "all",
  collection: "all",
  priority: "all",
  minQuality: "all",
  productionReady: "all",
};

export const assetTypeFilterOptions: (AssetType | "all")[] = [
  "all",
  "image",
  "video",
  "audio",
  "3d",
  "other",
];

export const assetStatusFilterOptions: (AssetStatus | "all")[] = [
  "all",
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "PRODUCTION_READY",
];
