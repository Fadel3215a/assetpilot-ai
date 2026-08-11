"use client";

import { AppShell } from "@/components/app-shell";
import { AssetGrid } from "@/components/asset-grid";

export function AssetLibraryPage() {
  return (
    <AppShell
      title="Asset Library"
      description="Browse, filter, and inspect AI-generated demo assets across collections."
    >
      <AssetGrid />
    </AppShell>
  );
}
