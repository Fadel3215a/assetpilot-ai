"use client";

import { AppShell } from "@/components/app-shell";
import { CurationQueueList } from "@/components/curation-queue-list";

export function CurationQueuePage() {
  return (
    <AppShell
      title="Curation Queue"
      description="Assets awaiting curator review — prioritized by workflow status and quality signals."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Curation Queue" },
      ]}
    >
      <CurationQueueList />
    </AppShell>
  );
}
