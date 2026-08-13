"use client";

import { useState } from "react";
import type { AssetFilterState, Collection } from "@/types";
import { assetTypeLabel, statusLabel } from "@/lib/utils";
import {
  assetStatusFilterOptions,
  assetTypeFilterOptions,
} from "@/lib/asset-search";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Button } from "./ui/button";

interface AssetFiltersProps {
  filters: AssetFilterState;
  onFiltersChange: (filters: AssetFilterState) => void;
  collections: Collection[];
  resultCount: number;
  totalCount: number;
}

export function AssetFilters({
  filters,
  onFiltersChange,
  collections,
  resultCount,
  totalCount,
}: AssetFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<AssetFilterState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <label htmlFor="asset-search" className="sr-only">
            Search assets
          </label>
          <Input
            id="asset-search"
            type="search"
            placeholder="Search name, description, tags, collection, type, status…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="type-filter" className="sr-only">
              Filter by asset type
            </label>
            <Select
              id="type-filter"
              value={filters.type}
              onChange={(e) => update({ type: e.target.value })}
            >
              {assetTypeFilterOptions.map((type) => (
                <option key={type} value={type}>
                  {type === "all" ? "All types" : assetTypeLabel(type)}
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
              value={filters.status}
              onChange={(e) => update({ status: e.target.value })}
            >
              {assetStatusFilterOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : statusLabel(status)}
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
              value={filters.collection}
              onChange={(e) => update({ collection: e.target.value })}
            >
              <option value="all">All collections</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "Fewer filters" : "More filters"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-3 rounded-md border border-border bg-surface p-3">
          <div>
            <label htmlFor="priority-filter" className="sr-only">
              Filter by priority
            </label>
            <Select
              id="priority-filter"
              value={filters.priority}
              onChange={(e) => update({ priority: e.target.value })}
            >
              <option value="all">All priorities</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </Select>
          </div>
          <div>
            <label htmlFor="quality-filter" className="sr-only">
              Minimum quality score
            </label>
            <Select
              id="quality-filter"
              value={filters.minQuality}
              onChange={(e) => update({ minQuality: e.target.value })}
            >
              <option value="all">Any quality score</option>
              <option value="70">Quality ≥ 70</option>
              <option value="80">Quality ≥ 80</option>
              <option value="90">Quality ≥ 90</option>
            </Select>
          </div>
          <div>
            <label htmlFor="production-filter" className="sr-only">
              Production readiness
            </label>
            <Select
              id="production-filter"
              value={filters.productionReady}
              onChange={(e) => update({ productionReady: e.target.value })}
            >
              <option value="all">Any production status</option>
              <option value="ready">Production ready</option>
              <option value="not-ready">Not production ready</option>
            </Select>
          </div>
        </div>
      )}

      <p className="text-sm text-muted">
        Showing {resultCount} of {totalCount} asset{totalCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
