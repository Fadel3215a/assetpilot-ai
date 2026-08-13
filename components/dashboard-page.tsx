"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DashboardStats } from "@/components/dashboard-stats";
import { AIAssistanceStats } from "@/components/ai-assistance-stats";
import { RecentActivity } from "@/components/recent-activity";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const workflowSteps = [
  { label: "Discover", href: "/assets" },
  { label: "Curate", href: "/curation" },
  { label: "Evaluate", href: "/curation" },
  { label: "Compare", href: "/compare" },
  { label: "Decide", href: "/reviews" },
  { label: "Prepare", href: "/production-ready" },
];

export function DashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      description="Operational overview — all metrics reflect your current session state."
    >
      <div className="space-y-8">
        <section aria-labelledby="asset-overview-heading">
          <h2 id="asset-overview-heading" className="section-label mb-4">
            Asset Overview
          </h2>
          <DashboardStats />
        </section>

        <section aria-labelledby="ai-assistance-heading">
          <AIAssistanceStats />
        </section>

        <section aria-labelledby="workflow-heading">
          <Card>
            <CardHeader>
              <h2 id="workflow-heading" className="section-title">
                Curation Workflow
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                AI assists. The curator evaluates and decides.
              </p>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-wrap gap-2">
                {workflowSteps.map((step, i) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent/30 hover:bg-surface-elevated"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-accent-muted text-[10px] font-bold text-accent">
                        {i + 1}
                      </span>
                      {step.label}
                    </Link>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="recent-activity-heading">
          <RecentActivity />
        </section>

        <Card className="border-accent/20 bg-accent-muted/30">
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-foreground">Suggested demo path</p>
            <p className="mt-1 text-sm text-muted">
              Dashboard → Curation Queue → Review Workspace → Compare Assets → Production Readiness.
              Also try Asset Library upload, metadata editing, and version management.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/curation">
                <Button type="button">Start with Curation Queue</Button>
              </Link>
              <Link href="/assets">
                <Button type="button" variant="secondary">
                  Browse Asset Library
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
