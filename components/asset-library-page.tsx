"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { AssetGrid } from "@/components/asset-grid";

function AssetGridFallback() {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
      Loading asset library…
    </p>
  );
}

export function AssetLibraryPage() {
  return (
    <AppShell
      title="Asset Library"
      description="Browse, upload session-only assets, search, filter, and inspect your library."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Asset Library" },
      ]}
    >
      <Suspense fallback={<AssetGridFallback />}>
        <AssetGrid />
      </Suspense>
    </AppShell>
  );
}
