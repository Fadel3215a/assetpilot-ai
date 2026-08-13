"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAssets } from "@/lib/assets-context";
import { evaluateProductionCriteria } from "@/lib/production";
import { findComparisonPartner, getCurrentVersion } from "@/lib/utils";
import { AppShell } from "./app-shell";
import { AIReadinessSummary } from "./ai-readiness-summary";
import { AssetThumbnail } from "./asset-thumbnail";
import { EmptyState } from "./empty-state";
import { StatusBadge } from "./status-badge";

export function ProductionReadyPage() {
  const { assets } = useAssets();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("asset");

  const evaluated = assets.map((asset) => ({
    asset,
    ...evaluateProductionCriteria(asset),
  }));

  const ready = evaluated.filter((e) => e.ready);
  const notReady = evaluated.filter((e) => !e.ready);

  return (
    <AppShell
      title="Production Readiness"
      description="Final production gate — curator checklist determines readiness. AI suggestions are simulated and labeled separately."
      headerSize="display"
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Production Ready" },
      ]}
    >
      <div className="space-y-10">
        <div className="grid gap-0 sm:grid-cols-2 sm:divide-x sm:divide-border">
          <div className="attention-stat px-0 sm:pr-8">
            <p className="section-label">Ready for Production</p>
            <p className="attention-stat-value mt-2 text-status-success">{ready.length}</p>
            <p className="mt-1 text-xs text-muted">Passed all curator checklist items</p>
          </div>
          <div className="attention-stat px-0 sm:pl-8">
            <p className="section-label">Not Ready / Review Required</p>
            <p className="attention-stat-value mt-2 text-status-warning">{notReady.length}</p>
            <p className="mt-1 text-xs text-muted">Incomplete checklist items remain</p>
          </div>
        </div>

        {evaluated.length === 0 ? (
          <EmptyState
            title="No assets to evaluate"
            description="Upload assets or reset the demo session to restore seeded data."
            actionLabel="Asset Library"
            actionHref="/assets"
          />
        ) : (
          <div className="divide-y divide-border">
            {evaluated.map(({ asset, items, score, ready: isReady }) => {
              const version = getCurrentVersion(asset);
              const isHighlighted = asset.id === highlightId;
              const comparePartnerId = findComparisonPartner(assets, asset.id);
              const blockingItems = items.filter((item) => !item.completed);

              return (
                <article
                  key={asset.id}
                  className={`flex flex-col gap-4 py-8 first:pt-0 sm:flex-row sm:items-start ${
                    isHighlighted ? "rounded-md ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
                  }`}
                >
                  <AssetThumbnail
                    src={version.thumbnailPath}
                    alt={`Preview for ${asset.name}`}
                    type={asset.type}
                    className="h-28 w-full shrink-0 rounded-md border border-border sm:h-24 sm:w-32"
                  />

                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/curation/${asset.id}`}
                          className="text-lg font-semibold text-foreground transition-colors hover:text-accent"
                        >
                          {asset.name}
                        </Link>
                        <p className="text-xs text-muted">
                          v{version.versionNumber} · Checklist {score}%
                        </p>
                      </div>
                      <span
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${
                          isReady
                            ? "bg-status-success-muted text-status-success"
                            : blockingItems.length > 0
                              ? "bg-status-warning-muted text-status-warning"
                              : "bg-status-neutral-muted text-status-neutral"
                        }`}
                      >
                        {isReady
                          ? "READY FOR PRODUCTION"
                          : blockingItems.length > 0
                            ? "NOT READY"
                            : "REVIEW REQUIRED"}
                      </span>
                    </div>

                    {!isReady && blockingItems.length > 0 && (
                      <p className="text-sm text-status-warning">
                        Blocking production: {blockingItems.map((i) => i.label).join(", ")}
                      </p>
                    )}

                    <AIReadinessSummary analysis={asset.aiAnalysis} />

                    <div>
                      <h4 className="section-label">Curator Production Checklist</h4>
                      <p className="mt-1 text-xs text-muted">
                        Final production status is determined by these checklist items, not AI suggestions.
                      </p>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {items.map((item) => (
                          <li key={item.id} className="flex items-center gap-2 text-sm">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                                item.completed
                                  ? "bg-status-success-muted text-status-success"
                                  : "bg-status-warning-muted text-status-warning"
                              }`}
                              aria-hidden="true"
                            >
                              {item.completed ? "✓" : "○"}
                            </span>
                            <span className={item.completed ? "text-foreground" : "text-status-warning"}>
                              {item.label}
                              {!item.completed && " — incomplete"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={asset.status} />
                      {comparePartnerId && (
                        <Link
                          href={`/compare?a=${asset.id}&b=${comparePartnerId}`}
                          className="text-xs text-accent hover:underline"
                        >
                          Compare assets
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
