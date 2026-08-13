"use client";

import { useAssets } from "@/lib/assets-context";
import { formatDate } from "@/lib/utils";
import { SourceBadge } from "./ui/source-badge";
import { Card, CardContent, CardHeader } from "./ui/card";

interface AssetActivityTimelineProps {
  assetId: string;
}

export function AssetActivityTimeline({ assetId }: AssetActivityTimelineProps) {
  const { getAssetTimeline } = useAssets();
  const timeline = getAssetTimeline(assetId);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Activity Timeline</h3>
        <p className="text-xs text-muted">
          Chronological activity — AI and curator actions are labeled separately.
        </p>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted">No activity recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-4">
            {timeline.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-accent" />
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge source={entry.source as "ai" | "curator" | "system"} />
                  <time className="text-xs text-muted" dateTime={entry.timestamp}>
                    {formatDate(entry.timestamp)}
                  </time>
                </div>
                <p className="mt-1 text-sm text-foreground">{entry.action}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
