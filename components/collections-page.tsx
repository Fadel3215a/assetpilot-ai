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
      description="Fictional project collections organizing demo assets by campaign and workflow stage."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Collections" },
      ]}
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
                  <h3 className="font-semibold text-foreground">{col.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {col.description}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted">Assets</dt>
                      <dd className="font-semibold text-foreground">{colAssets.length}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Approved</dt>
                      <dd className="font-semibold text-status-success">{approved}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Pending review</dt>
                      <dd className="font-semibold text-status-warning">{pending}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Production ready</dt>
                      <dd className="font-semibold text-accent">{productionReady}</dd>
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
