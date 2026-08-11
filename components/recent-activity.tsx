"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { formatRelativeTime } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./ui/card";

export function RecentActivity() {
  const { activity } = useAssets();

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Recent Activity
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          AI suggestions and curator actions on demo assets
        </p>
      </CardHeader>
      <CardContent className="divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
        <ul>
          {activity.slice(0, 10).map((item) => (
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
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                        item.source === "ai"
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {item.source}
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
      </CardContent>
    </Card>
  );
}
