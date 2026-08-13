"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DashboardFeaturedWorkspace } from "@/components/dashboard-featured-workspace";
import { DashboardAttention } from "@/components/dashboard-attention";
import { DashboardWorkflowPipeline } from "@/components/dashboard-workflow-pipeline";
import { AIAssistanceStats } from "@/components/ai-assistance-stats";
import { RecentActivity } from "@/components/recent-activity";
import { Button } from "@/components/ui/button";
import { useAssets } from "@/lib/assets-context";

export function DashboardPage() {
  const { stats } = useAssets();

  return (
    <AppShell hideHeader>
      <div className="space-y-12 lg:space-y-16">
        <section aria-labelledby="dashboard-hero">
          <p id="dashboard-hero" className="display-subtitle">
            AssetPilot AI
          </p>
          <h1 className="display-title mt-2 max-w-3xl">
            AI-assisted digital asset curation
          </h1>
          <p className="editorial-lead mt-4">
            {stats.total} assets in your session workspace — curated with simulated AI assistance
            and human-in-the-loop decisions.
          </p>
          <div className="mt-6">
            <Link href="/curation">
              <Button type="button">Open Curation Queue</Button>
            </Link>
          </div>
        </section>

        <section aria-labelledby="workspace-heading" className="editorial-section">
          <h2 id="workspace-heading" className="section-label mb-6">
            Workspace
          </h2>
          <DashboardFeaturedWorkspace />
        </section>

        <section aria-labelledby="attention-heading" className="editorial-section">
          <h2 id="attention-heading" className="section-label mb-2">
            Attention
          </h2>
          <DashboardAttention />
        </section>

        <section aria-labelledby="workflow-heading" className="editorial-section">
          <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="workflow-heading" className="section-label">
                Curation Workflow
              </h2>
              <p className="mt-1 text-sm text-muted">
                AI assists. The curator evaluates and decides.
              </p>
            </div>
          </div>
          <DashboardWorkflowPipeline />
        </section>

        <section aria-labelledby="recent-activity-heading" className="editorial-section">
          <RecentActivity compact />
        </section>

        <section aria-labelledby="ai-assistance-heading" className="editorial-section">
          <AIAssistanceStats />
        </section>
      </div>
    </AppShell>
  );
}
