"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { isQueueAsset } from "@/lib/production";
import { AppShell } from "./app-shell";
import { Card, CardContent } from "./ui/card";

export function CollectionsPage() {
  const { collections, assets } = useAssets();

  return (
    <AppShell
      title="Collections"
      description="Fictional project collections organizing demo AI-generated assets."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((col) => {
          const colAssets = assets.filter((a) => a.collectionId === col.id);
          const approved = colAssets.filter((a) => a.status === "APPROVED").length;
          const pending = colAssets.filter((a) => isQueueAsset(a.status)).length;
          const productionReady = colAssets.filter((a) => a.status === "PRODUCTION_READY").length;

          return (
            <Link key={col.id} href={`/collections/${col.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="pt-5">
                  <div
                    className="mb-3 h-1 w-12 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{col.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {col.description}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-zinc-400">Assets</dt>
                      <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{colAssets.length}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">Approved</dt>
                      <dd className="font-semibold text-emerald-600">{approved}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">Pending</dt>
                      <dd className="font-semibold text-amber-600">{pending}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">Production</dt>
                      <dd className="font-semibold text-indigo-600">{productionReady}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
