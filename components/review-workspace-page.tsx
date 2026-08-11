"use client";

import { AppShell } from "@/components/app-shell";
import { ReviewWorkspace } from "@/components/review-workspace";

export function ReviewWorkspacePage({ assetId }: { assetId: string }) {
  return (
    <AppShell
      title="Curator Review"
      description="Structured quality evaluation and human-in-the-loop decision making."
    >
      <ReviewWorkspace assetId={assetId} />
    </AppShell>
  );
}
