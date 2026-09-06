"use client";

import { useState, type FormEvent } from "react";
import { useAssets } from "@/lib/assets-context";
import type { Asset, AssetSearchHit } from "@/types";
import { AppShell } from "./app-shell";
import { AssetCard } from "./asset-card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface SearchResultSet {
  assets: Asset[];
  hits: AssetSearchHit[];
}

/**
 * Stage 4.2 — Hybrid semantic search page.
 *
 * Drives the context's `searchAssets` (backed by `hybridSearchAssets` in
 * `lib/server/queries.ts`) and renders results as asset cards with match
 * badges (Vector / Text / Hybrid) and confidence scores.
 */
export function SearchPage() {
  const { searchAssets, collections } = useAssets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultSet | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const collectionById = new Map(collections.map((c) => [c.id, c]));

  async function runSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setStatus("searching");
    setError(null);
    const res = await searchAssets(trimmed);
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

  return (
    <AppShell
      title="Hybrid Search"
      description="Semantic vector and full-text search over the asset inventory."
      breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Search" }]}
    >
      <form onSubmit={onSubmit} className="flex max-w-2xl gap-2" role="search">
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
      </form>

      {status === "idle" && (
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
          Runs <span className="font-medium text-foreground">vector similarity</span> (pgvector) and{" "}
          <span className="font-medium text-foreground">full-text search</span> (PostgreSQL
          ts_rank), then fuses both signals. Each result shows a match badge with its confidence.
        </p>
      )}

      {status === "error" && (
        <p role="alert" className="mt-6 text-sm text-status-danger">
          {error}
        </p>
      )}

      {status === "done" && results && (
        <section aria-live="polite" className="mt-6">
          {results.assets.length === 0 ? (
            <p className="text-sm text-muted">No matching assets found.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">
                {results.assets.length} result{results.assets.length === 1 ? "" : "s"} for “
                {query.trim()}”.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    collection={collectionById.get(asset.collectionId)}
                    hit={results.hits.find((h) => h.assetId === asset.id)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </AppShell>
  );
}