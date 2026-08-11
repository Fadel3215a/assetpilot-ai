import type { AssetStatus, AssetType, Collection } from "@/types";
import { statusLabel } from "@/lib/utils";
import { assetTypeLabel } from "@/lib/utils";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

interface AssetFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: AssetType | "all";
  onTypeChange: (value: AssetType | "all") => void;
  statusFilter: AssetStatus | "all";
  onStatusChange: (value: AssetStatus | "all") => void;
  collectionFilter: string;
  onCollectionChange: (value: string) => void;
  collections: Collection[];
  resultCount: number;
}

const statuses: AssetStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "PRODUCTION_READY",
];

const types: AssetType[] = ["image", "video", "audio", "3d"];

export function AssetFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  collectionFilter,
  onCollectionChange,
  collections,
  resultCount,
}: AssetFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <label htmlFor="asset-search" className="sr-only">
            Search assets by name
          </label>
          <Input
            id="asset-search"
            type="search"
            placeholder="Search by asset name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="type-filter" className="sr-only">
              Filter by asset type
            </label>
            <Select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => onTypeChange(e.target.value as AssetType | "all")}
            >
              <option value="all">All types</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {assetTypeLabel(type)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="status-filter" className="sr-only">
              Filter by status
            </label>
            <Select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as AssetStatus | "all")}
            >
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="collection-filter" className="sr-only">
              Filter by collection
            </label>
            <Select
              id="collection-filter"
              value={collectionFilter}
              onChange={(e) => onCollectionChange(e.target.value)}
            >
              <option value="all">All collections</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Showing {resultCount} asset{resultCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
