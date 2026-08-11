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
          Curator actions on demo assets
        </p>
      </CardHeader>
      <CardContent className="divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
        <ul>
          {activity.slice(0, 8).map((item) => (
            <li key={item.id}>
              <Link
                href={`/assets/${item.assetId}`}
                className="flex items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.assetName}
                  </p>
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
