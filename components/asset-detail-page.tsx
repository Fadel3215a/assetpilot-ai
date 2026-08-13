"use client";

import { AppShell } from "@/components/app-shell";
import { AssetDetailView } from "@/components/asset-detail-view";
import { useAssets } from "@/lib/assets-context";

export function AssetDetailPage({ assetId }: { assetId: string }) {
  const { getAsset } = useAssets();
  const asset = getAsset(assetId);

  return (
    <AppShell
      title={asset?.name ?? "Asset Detail"}
      description="Inspect metadata, health, versions, and AI suggestions — curator decisions happen in Review Workspace."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Asset Library", href: "/assets" },
        { label: asset?.name ?? "Asset" },
      ]}
    >
      <AssetDetailView assetId={assetId} />
    </AppShell>
  );
}
