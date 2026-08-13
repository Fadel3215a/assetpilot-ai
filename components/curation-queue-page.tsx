"use client";

import { AppShell } from "@/components/app-shell";
import { CurationQueueList } from "@/components/curation-queue-list";

export function CurationQueuePage() {
  return (
    <AppShell
      title="Curation Queue"
      description="Creative review pipeline — assets awaiting curator attention, prioritized by workflow status."
      headerSize="display"
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Curation Queue" },
      ]}
    >
      <CurationQueueList />
    </AppShell>
  );
}
