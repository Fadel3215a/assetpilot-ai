"use client";

import { AppShell } from "@/components/app-shell";
import { AssetDetailView } from "@/components/asset-detail-view";

export function AssetDetailPage({ assetId }: { assetId: string }) {
  return (
    <AppShell
      title="Asset Review"
      description="Inspect asset details and record curator decisions."
    >
      <AssetDetailView assetId={assetId} />
    </AppShell>
  );
}
