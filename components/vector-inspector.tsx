"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { VectorAnalytics, VectorNeighbor } from "@/lib/server/queries";
import { StatusBadge } from "./status-badge";

interface VectorApiShape {
  ok: boolean;
  error?: string;
  assetId?: string;
  embedded?: boolean;
  embeddingDimensions?: number;
  neighbors?: VectorNeighbor[];
}

interface AnalyticsApiShape {
  ok: boolean;
  error?: string;
}

type LoadState = "loading" | "ready" | "error";

/**
 * Stage 4.3 — Vector inspector panel.
 *
 * Shows a single asset's embedding health (dimension size, indexed state) plus
 * the top nearest neighbors from `/api/assets/[id]/vector` with cosine/L2
 * distance badges, and the inventory-wide index status from
 * `/api/search/analytics`. VIEWER-accessible via the underlying routes.
 */
export function VectorInspector({ assetId }: { assetId: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [vector, setVector] = useState<VectorApiShape | null>(null);
  const [analytics, setAnalytics] = useState<VectorAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`/api/assets/${encodeURIComponent(assetId)}/vector?limit=6`).then((r) => r.json()),
      fetch("/api/search/analytics").then((r) => r.json()),
    ])
      .then(([vectorRes, analyticsRes]) => {
        if (cancelled) return;
        const v = vectorRes as VectorApiShape;
        const a = analyticsRes as AnalyticsApiShape;
        if (!v.ok) {
          setError(v.error ?? "Could not load vector information.");
          setState("error");
          return;
        }
        setVector(v);
        if (a.ok) setAnalytics(analyticsRes as VectorAnalytics);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load vector information.");
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const embedded = Boolean(vector?.embedded);
  const dimensions = vector?.embeddingDimensions ?? 1536;
  const neighbors = vector?.neighbors ?? [];

  return (
    <section className="editorial-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="section-title">Vector Embedding</h3>
          <p className="mt-1 text-xs text-muted">
            pgvector health and nearest neighbors for this asset.
          </p>
        </div>
        {embedded && dimensions > 0 && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${
              embedded
                ? "border-status-success/20 bg-status-success-muted text-status-success"
                : "border-status-warning/20 bg-status-warning-muted text-status-warning"
            }`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {embedded ? "Indexed" : "Not indexed"}
          </span>
        )}
      </div>

      {state === "loading" && <p className="mt-4 text-sm text-muted">Inspecting vector…</p>}
      {state === "error" && (
        <p role="alert" className="mt-4 text-sm text-status-danger">
          {error}
        </p>
      )}

      {state === "ready" && !embedded && (
        <p className="mt-4 rounded-md border border-status-warning/30 bg-status-warning-muted px-3 py-2 text-sm text-status-warning">
          This asset has no embedding yet. The search index may be stale — use the
          &quot;Re-index vectors&quot; control in the sidebar to rebuild embeddings.
        </p>
      )}

      {state === "ready" && embedded && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <dt className="meta-label">Dimensions</dt>
              <dd className="mt-1 text-sm font-medium">{dimensions}</dd>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <dt className="meta-label">HNSW index</dt>
              <dd className="mt-1 text-sm font-medium">
                {analytics?.hnswIndexEnabled ? "Enabled" : "Missing"}
              </dd>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <dt className="meta-label">Index coverage</dt>
              <dd className="mt-1 text-sm font-medium">
                {analytics ? `${analytics.indexedAssets}/${analytics.totalAssets} assets` : "—"}
              </dd>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <dt className="meta-label">Vector engine</dt>
              <dd className="mt-1 text-sm font-medium">
                {analytics?.vectorExtensionAvailable ? "pgvector" : "Unavailable"}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <p className="section-label">Nearest neighbors</p>
            {neighbors.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No other indexed assets to compare against.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {neighbors.map((neighbor) => (
                  <li key={neighbor.assetId}>
                    <Link
                      href={`/assets/${neighbor.assetId}`}
                      className="group flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 transition-[border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] hover:border-accent/30 hover:bg-surface-elevated"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground group-hover:text-accent">
                          {neighbor.name}
                        </span>
                        <StatusBadge status={neighbor.status} />
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-sm border border-accent/25 bg-accent/5 px-1.5 py-0.5 text-[11px] font-medium text-accent"
                          title="Cosine distance: 1 - (a <=> b)"
                        >
                          cos {neighbor.cosineDistance.toFixed(3)}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-medium text-muted"
                          title="L2 (Euclidean) distance: a <-> b"
                        >
                          L2 {neighbor.l2Distance.toFixed(2)}
                        </span>
                        <span className="hidden text-[11px] text-muted sm:inline">
                          IP {neighbor.innerProduct.toFixed(2)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Distances: <span className="font-medium text-foreground">cos</span> = 1 − cosine
            similarity (larger = closer) · <span className="font-medium text-foreground">L2</span>{" "}
            = Euclidean distance · <span className="font-medium text-foreground">IP</span> = inner
            product (a · b, negated). All three measure the same 1536-dim embedding vectors.
          </p>
        </>
      )}
    </section>
  );
}