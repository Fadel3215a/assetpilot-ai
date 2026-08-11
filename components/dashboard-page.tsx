"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DashboardStats } from "@/components/dashboard-stats";
import { RecentActivity } from "@/components/recent-activity";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const workflowSteps = [
  "Intake",
  "Organization",
  "Curation",
  "Quality Review",
  "Classification",
  "Comparison",
  "Approve / Reject",
  "Version Tracking",
  "Production Readiness",
];

export function DashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      description="Overview of your AI asset curation workflow — all metrics are demo data."
    >
      <div className="space-y-8">
        <DashboardStats />

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Curation Workflow
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Human curators guide AI-generated assets through structured review stages
            </p>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-wrap gap-2">
              {workflowSteps.map((step, i) => (
                <li
                  key={step}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <RecentActivity />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/curation"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Go to Curation Queue →
          </Link>
          <Link
            href="/production-ready"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Check Production Readiness →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
