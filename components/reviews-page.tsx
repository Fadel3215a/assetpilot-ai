"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { formatDate } from "@/lib/utils";
import { AppShell } from "./app-shell";
import { AIFeedbackHistory } from "./ai-feedback-history";
import { DecisionHistoryPanel } from "./decision-history-panel";
import { EmptyState } from "./empty-state";
import { Card, CardContent, CardHeader } from "./ui/card";

const sourceLabel = (source: "ai" | "curator") =>
  source === "ai" ? "AI" : "Curator";

export function ReviewsPage() {
  const { stats, getAllDecisionHistory, comparisons, activity, feedback } = useAssets();
  const history = getAllDecisionHistory();

  const approvals = history.filter((h) => h.decision === "APPROVED").length;
  const rejections = history.filter((h) => h.decision === "REJECTED").length;
  const changeRequests = history.filter((h) => h.decision === "CHANGES_REQUESTED").length;

  return (
    <AppShell
      title="Reviews"
      description="Operational history of curator decisions, comparisons, and AI suggestion feedback."
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Reviews" },
      ]}
    >
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Approvals", value: approvals, color: "text-emerald-600" },
            { label: "Rejections", value: rejections, color: "text-red-600" },
            { label: "Request Changes", value: changeRequests, color: "text-orange-600" },
            { label: "Comparisons", value: comparisons.length, color: "text-indigo-600" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-5">
                <p className="text-sm text-zinc-500">{stat.label}</p>
                <p className={`mt-1 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="mt-1 text-xs text-zinc-400">Current session</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {history.length === 0 ? (
            <EmptyState
              title="No curator decisions yet"
              description="Open the Curation Queue and record Approve, Request Changes, or Reject decisions."
              actionLabel="Curation Queue"
              actionHref="/curation"
            />
          ) : (
            <DecisionHistoryPanel history={history} limit={10} />
          )}

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Recent Activity</h3>
              <p className="text-xs text-zinc-500">AI and curator actions are labeled separately</p>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-zinc-500">No activity recorded this session.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {activity.slice(0, 10).map((item) => (
                    <li key={item.id} className="py-3 first:pt-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/curation/${item.assetId}`}
                          className="text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {item.assetName}
                        </Link>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            item.source === "ai"
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                          }`}
                        >
                          {sourceLabel(item.source)}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500">{item.action}</p>
                      <time className="text-xs text-zinc-400" dateTime={item.timestamp}>
                        {formatDate(item.timestamp)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <AIFeedbackHistory feedback={feedback} />

        <p className="text-xs text-zinc-400">
          Session summary: {stats.approved} approved · {stats.rejected} rejected · {stats.needsChanges} need changes
        </p>
      </div>
    </AppShell>
  );
}
