"use client";

import { AppShell } from "@/components/app-shell";
import { CurationQueueList } from "@/components/curation-queue-list";

export function CurationQueuePage() {
  return (
    <AppShell
      title="Curation Queue"
      description="Assets awaiting human curator review — prioritized demo queue."
    >
      <CurationQueueList />
    </AppShell>
  );
}
