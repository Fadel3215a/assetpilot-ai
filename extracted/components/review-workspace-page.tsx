"use client";

import { AppShell } from "@/components/app-shell";
import { ReviewWorkspace } from "@/components/review-workspace";
import { useAssets } from "@/lib/assets-context";

export function ReviewWorkspacePage({ assetId }: { assetId: string }) {
  const { getAsset } = useAssets();
  const asset = getAsset(assetId);

  return (
    <AppShell
      title="Review Workspace"
      description="AI-Assisted Analysis supports your review. Curator Evaluation and final decisions remain yours."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Curation Queue", href: "/curation" },
        { label: asset?.name ?? "Review" },
      ]}
    >
      <ReviewWorkspace assetId={assetId} />
    </AppShell>
  );
}
