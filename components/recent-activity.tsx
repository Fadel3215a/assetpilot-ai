"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { formatRelativeTime } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { SourceBadge } from "./ui/source-badge";

interface RecentActivityProps {
  compact?: boolean;
}

export function RecentActivity({ compact = false }: RecentActivityProps) {
  const { activity } = useAssets();
  const recent = activity.slice(0, compact ? 6 : 10);

  return (
    <div>
      <h2 id="recent-activity-heading" className="section-label mb-1">
        Recent Activity
      </h2>
      {!compact && (
        <p className="mb-4 text-xs text-muted">
          AI suggestions and curator actions — labeled by source
        </p>
      )}

      {recent.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Start reviewing assets in the Curation Queue to populate activity."
          actionLabel="Curation Queue"
          actionHref="/curation"
        />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {recent.map((item) => (
            <li key={item.id}>
              <Link
                href={`/curation/${item.assetId}`}
                className="flex items-start justify-between gap-4 py-3 transition-colors hover:text-accent"
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
    </div>
  );
}
