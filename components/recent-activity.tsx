"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { formatRelativeTime } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./ui/card";
import { EmptyState } from "./empty-state";
import { SourceBadge } from "./ui/source-badge";

export function RecentActivity() {
  const { activity } = useAssets();
  const recent = activity.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <h2 id="recent-activity-heading" className="section-title">
          Recent Activity
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          AI suggestions and curator actions — labeled by source
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {recent.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              title="No activity yet"
              description="Start reviewing assets in the Curation Queue to populate activity."
              actionLabel="Curation Queue"
              actionHref="/curation"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/curation/${item.assetId}`}
                  className="flex items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-elevated"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{item.assetName}</p>
                      <SourceBadge source={item.source === "ai" ? "ai" : "curator"} />
                    </div>
                    <p className="text-sm text-muted">{item.action}</p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-muted"
                    dateTime={item.timestamp}
                  >
                    {formatRelativeTime(item.timestamp)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
