"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { formatDate } from "@/lib/utils";
import { AppShell } from "./app-shell";
import { AIFeedbackHistory } from "./ai-feedback-history";
import { DecisionHistoryPanel } from "./decision-history-panel";
import { EmptyState } from "./empty-state";
import { SourceBadge } from "./ui/source-badge";

export function ReviewsPage() {
  const { stats, getAllDecisionHistory, comparisons, activity, feedback } = useAssets();
  const history = getAllDecisionHistory();

  const approvals = history.filter((h) => h.decision === "APPROVED").length;
  const rejections = history.filter((h) => h.decision === "REJECTED").length;
  const changeRequests = history.filter((h) => h.decision === "CHANGES_REQUESTED").length;

  const statItems = [
    { label: "Approvals", value: approvals, color: "text-status-success" },
    { label: "Rejections", value: rejections, color: "text-status-danger" },
    { label: "Request Changes", value: changeRequests, color: "text-status-warning" },
    { label: "Comparisons", value: comparisons.length, color: "text-accent" },
  ];

  return (
    <AppShell
      title="Reviews"
      description="Editorial history of curator decisions, comparisons, and AI suggestion feedback."
      headerSize="display"
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Reviews" },
      ]}
    >
      <div className="space-y-10">
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4 sm:divide-x sm:divide-border">
          {statItems.map(({ label, value, color }, index) => (
            <div
              key={label}
              className={`attention-stat px-0 ${
                index === 0 ? "sm:pr-6" : index === statItems.length - 1 ? "sm:pl-6" : "sm:px-6"
              }`}
            >
              <p className="section-label">{label}</p>
              <p className={`attention-stat-value mt-2 ${color}`}>{value}</p>
              <p className="mt-1 text-xs text-muted">Current session</p>
            </div>
          ))}
        </div>

        <div className="grid gap-10 lg:grid-cols-2">
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

          <section>
            <h3 className="section-title">Recent Activity</h3>
            <p className="mt-0.5 text-xs text-muted">AI and curator actions are labeled separately</p>
            <div className="mt-4">
              {activity.length === 0 ? (
                <p className="text-sm text-muted">No activity recorded this session.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {activity.slice(0, 10).map((item) => (
                    <li key={item.id} className="py-3 first:pt-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/curation/${item.assetId}`}
                          className="text-sm font-medium text-foreground transition-colors hover:text-accent"
                        >
                          {item.assetName}
                        </Link>
                        <SourceBadge source={item.source} />
                      </div>
                      <p className="text-sm text-muted">{item.action}</p>
                      <time className="text-xs text-muted" dateTime={item.timestamp}>
                        {formatDate(item.timestamp)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <section className="editorial-section">
          <AIFeedbackHistory feedback={feedback} />
        </section>

        <p className="text-xs text-muted">
          Session summary: {stats.approved} approved · {stats.rejected} rejected · {stats.needsChanges} need changes
        </p>
      </div>
    </AppShell>
  );
}
