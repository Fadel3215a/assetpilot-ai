"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAssets } from "@/lib/assets-context";
import { evaluateProductionCriteria } from "@/lib/production";
import { findComparisonPartner, getCurrentVersion } from "@/lib/utils";
import { AppShell } from "./app-shell";
import { AIReadinessSummary } from "./ai-readiness-summary";
import { EmptyState } from "./empty-state";
import { StatusBadge } from "./status-badge";
import { Card, CardContent, CardHeader } from "./ui/card";

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
      description="Curator production checklist drives final status. AI readiness suggestions are simulated and labeled separately."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Production Ready" },
      ]}
    >
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardContent className="pt-5">
              <p className="text-sm text-zinc-500">Ready for Production</p>
              <p className="text-3xl font-bold text-emerald-600">{ready.length}</p>
              <p className="mt-1 text-xs text-zinc-400">Passed all curator checklist items</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-900">
            <CardContent className="pt-5">
              <p className="text-sm text-zinc-500">Not Ready / Review Required</p>
              <p className="text-3xl font-bold text-amber-600">{notReady.length}</p>
              <p className="mt-1 text-xs text-zinc-400">Incomplete checklist items remain</p>
            </CardContent>
          </Card>
        </div>

        {evaluated.length === 0 ? (
          <EmptyState
            title="No assets to evaluate"
            description="Upload assets or reset the demo session to restore seeded data."
            actionLabel="Asset Library"
            actionHref="/assets"
          />
        ) : (
          <div className="space-y-4">
            {evaluated.map(({ asset, items, score, ready: isReady }) => {
              const version = getCurrentVersion(asset);
              const isHighlighted = asset.id === highlightId;
              const comparePartnerId = findComparisonPartner(assets, asset.id);
              const blockingItems = items.filter((item) => !item.completed);

              return (
                <Card
                  key={asset.id}
                  className={isHighlighted ? "ring-2 ring-indigo-500" : undefined}
                >
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link
                          href={`/curation/${asset.id}`}
                          className="font-semibold hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {asset.name}
                        </Link>
                        <p className="text-xs text-zinc-500">v{version.versionNumber} · Checklist {score}%</p>
                      </div>
                      <span
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${
                          isReady
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : blockingItems.length > 0
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {isReady
                          ? "READY FOR PRODUCTION"
                          : blockingItems.length > 0
                            ? "NOT READY"
                            : "REVIEW REQUIRED"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AIReadinessSummary analysis={asset.aiAnalysis} />

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Curator Production Checklist
                      </h4>
                      <p className="mt-1 text-xs text-zinc-400">
                        Final production status is determined by these checklist items, not AI suggestions.
                      </p>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {items.map((item) => (
                          <li key={item.id} className="flex items-center gap-2 text-sm">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                                item.completed
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              }`}
                              aria-hidden="true"
                            >
                              {item.completed ? "✓" : "○"}
                            </span>
                            <span className={item.completed ? "text-zinc-700 dark:text-zinc-300" : "text-amber-800 dark:text-amber-300"}>
                              {item.label}
                              {!item.completed && " — incomplete"}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {!isReady && blockingItems.length > 0 && (
                        <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
                          Blocking production: {blockingItems.map((i) => i.label).join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={asset.status} />
                      {comparePartnerId && (
                        <Link
                          href={`/compare?a=${asset.id}&b=${comparePartnerId}`}
                          className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Compare assets
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
