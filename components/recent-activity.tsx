"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { formatRelativeTime } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./ui/card";
import { EmptyState } from "./empty-state";

export function RecentActivity() {
  const { activity } = useAssets();
  const recent = activity.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <h2 id="recent-activity-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Recent Activity
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
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
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/curation/${item.assetId}`}
                  className="flex items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {item.assetName}
                      </p>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          item.source === "ai"
                            ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        }`}
                      >
                        {item.source === "ai" ? "AI" : "Curator"}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.action}</p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500"
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
