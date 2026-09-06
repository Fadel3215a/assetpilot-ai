"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useAssets } from "@/lib/assets-context";
import type { Asset, AssetSearchHit } from "@/types";
import { AppShell } from "./app-shell";
import { AssetCard } from "./asset-card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { HybridSearchDial } from "./hybrid-search-dial";
import { ColorFilterChips, type VisualTone } from "./color-filter-chips";

interface SearchResultSet {
  assets: Asset[];
  hits: AssetSearchHit[];
}

const itemTransition = {
  opacity: { duration: 0.2, ease: "easeOut" },
  y: { type: "spring", stiffness: 340, damping: 30 },
  layout: { type: "spring", stiffness: 300, damping: 32 },
} as const;

/**
 * Stage 4.2 + 1.2 — Hybrid semantic search page.
 *
 * Drives the context's `searchAssets` (backed by `hybridSearchAssets`) and
 * renders results as asset cards with match badges. The HybridSearchDial tunes
 * the vector-vs-text blend forwarded to /api/search, and ColorFilterChips
 * refines the returned results by each asset's sampled dominant visual tone.
 */
export function SearchPage() {
  const { searchAssets, collections } = useAssets();
  const [query, setQuery] = useState("");
  const [vectorWeight, setVectorWeight] = useState(0.55);
  const [results, setResults] = useState<SearchResultSet | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<VisualTone | null>(null);
  const [toneByAsset, setToneByAsset] = useState<ReadonlyMap<string, VisualTone>>(new Map());

  const collectionById = new Map(collections.map((c) => [c.id, c]));

  async function runSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setStatus("searching");
    setError(null);
    const res = await searchAssets(trimmed, { vectorWeight });
    if (res.ok) {
      setResults({ assets: res.assets ?? [], hits: res.hits ?? [] });
      setStatus("done");
    } else {
      setStatus("error");
      setError(res.error ?? "Search failed. Please try again.");
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  function onDialChange(value: number) {
    setVectorWeight(value);
    if (status === "done" && query.trim()) {
      void runSearch(query);
    }
  }

  const toneAssets = results?.assets ?? [];
  const visibleAssets = selectedTone
    ? toneAssets.filter((a) => toneByAsset.get(a.id) === selectedTone)
    : toneAssets;

  return (
    <AppShell
      title="Hybrid Search"
      description="Semantic vector and full-text search over the asset inventory."
      breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Search" }]}
    >
      <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-3" role="search">
        <div className="flex w-full gap-2">
          <label className="sr-only" htmlFor="hybrid-search-input">
            Search assets
          </label>
          <Input
            id="hybrid-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try &quot;stylized mountain ridge&quot;…"
            disabled={status === "searching"}
          />
          <Button type="submit" disabled={status === "searching"}>
            {status === "searching" ? "Searching…" : "Search"}
          </Button>
        </div>
        <div className="max-w-xl">
          <HybridSearchDial
            value={vectorWeight}
            onChange={onDialChange}
            disabled={status === "searching"}
          />
        </div>
      </form>

      {status === "idle" && (
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
          Runs <span className="font-medium text-foreground">vector similarity</span> (pgvector) and{" "}
          <span className="font-medium text-foreground">full-text search</span> (PostgreSQL
          ts_rank), then fuses both signals. Drag the blend dial to weight Vector vs Text, and
          filter results by visual tone. Each result shows a match badge with its confidence.
        </p>
      )}

      {status === "error" && (
        <p role="alert" className="mt-6 text-sm text-status-danger">
          {error}
        </p>
      )}

      {(status === "done" || (status === "idle" && results)) && results && (
        <section aria-live="polite" className="mt-6">
          {toneAssets.length === 0 ? (
            <p className="text-sm text-muted">No matching assets found.</p>
          ) : (
            <>
              <div className="mb-4 space-y-3">
                <p className="text-sm text-muted">
                  {toneAssets.length} result{toneAssets.length === 1 ? "" : "s"} for “
                  {query.trim()}” · {Math.round(vectorWeight * 100)}% vector blend
                  {selectedTone ? ` · filtered by ${selectedTone}` : ""}.
                </p>
                <ColorFilterChips
                  assets={toneAssets}
                  selectedTone={selectedTone}
                  onToneChange={setSelectedTone}
                  onTonesComputed={setToneByAsset}
                />
              </div>
              <LayoutGroup>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {visibleAssets.map((asset) => (
                      <motion.div
                        key={asset.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={itemTransition}
                      >
                        <AssetCard
                          asset={asset}
                          collection={collectionById.get(asset.collectionId)}
                          hit={results.hits.find((h) => h.assetId === asset.id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </LayoutGroup>
            </>
          )}
        </section>
      )}
    </AppShell>
  );
}