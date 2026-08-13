"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DashboardStats } from "@/components/dashboard-stats";
import { AIAssistanceStats } from "@/components/ai-assistance-stats";
import { RecentActivity } from "@/components/recent-activity";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
          <h2 id="asset-overview-heading" className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
              <h2 id="workflow-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Curation Workflow
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                AI assists. The curator evaluates and decides.
              </p>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-wrap gap-2">
                {workflowSteps.map((step, i) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
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

        <Card className="border-indigo-100 bg-indigo-50/30 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Suggested demo path</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Dashboard → Curation Queue → Review Workspace → Compare Assets → Production Readiness.
              Also try Asset Library upload, metadata editing, and version management.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/curation"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Start with Curation Queue
              </Link>
              <Link
                href="/assets"
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Browse Asset Library
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
