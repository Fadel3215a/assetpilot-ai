"use client";

import { useAssets } from "@/lib/assets-context";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./ui/card";

interface AssetActivityTimelineProps {
  assetId: string;
}

const sourceStyles: Record<string, string> = {
  ai: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  curator: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  system: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const sourceLabels: Record<string, string> = {
  ai: "AI",
  curator: "Curator",
  system: "System",
};

export function AssetActivityTimeline({ assetId }: AssetActivityTimelineProps) {
  const { getAssetTimeline } = useAssets();
  const timeline = getAssetTimeline(assetId);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Activity Timeline</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Chronological activity — AI and curator actions are labeled separately.
        </p>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-zinc-200 pl-4 dark:border-zinc-700">
            {timeline.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sourceStyles[entry.source] ?? sourceStyles.system}`}
                  >
                    {sourceLabels[entry.source] ?? entry.source}
                  </span>
                  <time className="text-xs text-zinc-400" dateTime={entry.timestamp}>
                    {formatDate(entry.timestamp)}
                  </time>
                </div>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{entry.action}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
