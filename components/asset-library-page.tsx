"use client";

import { AppShell } from "@/components/app-shell";
import { AssetGrid } from "@/components/asset-grid";

export function AssetLibraryPage() {
  return (
    <AppShell
      title="Asset Library"
      description="Browse, upload session-only assets, search, filter, and inspect your library."
    >
      <AssetGrid />
    </AppShell>
  );
}
