"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAssets } from "@/lib/assets-context";
import { evaluateProductionCriteria } from "@/lib/production";
import { findComparisonPartner, getCurrentVersion } from "@/lib/utils";
import { AppShell } from "./app-shell";
import { AIReadinessSummary } from "./ai-readiness-summary";
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
      description="Checklist-based readiness assessment — curator-driven, not automated certification."
    >
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardContent className="pt-5">
              <p className="text-sm text-zinc-500">Ready for Production</p>
              <p className="text-3xl font-bold text-emerald-600">{ready.length}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-900">
            <CardContent className="pt-5">
              <p className="text-sm text-zinc-500">Not Ready</p>
              <p className="text-3xl font-bold text-amber-600">{notReady.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {evaluated.map(({ asset, items, score, ready: isReady }) => {
            const version = getCurrentVersion(asset);
            const isHighlighted = asset.id === highlightId;
            const comparePartnerId = findComparisonPartner(assets, asset.id);

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
                      <p className="text-xs text-zinc-500">v{version.versionNumber} · Score {score}%</p>
                    </div>
                    <span
                      className={`rounded-md px-3 py-1 text-xs font-semibold ${
                        isReady
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {isReady ? "READY FOR PRODUCTION" : "NOT READY"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <AIReadinessSummary analysis={asset.aiAnalysis} />
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                            item.completed
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                          }`}
                          aria-hidden="true"
                        >
                          {item.completed ? "✓" : "○"}
                        </span>
                        <span className={item.completed ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusBadge status={asset.status} />
                    {comparePartnerId && (
                      <Link
                        href={`/compare?a=${asset.id}&b=${comparePartnerId}`}
                        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Compare
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
