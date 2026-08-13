"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { Card, CardContent } from "./ui/card";

const statConfig = [
  { key: "total" as const, label: "Total Assets", href: "/assets", color: "text-zinc-900 dark:text-zinc-50" },
  { key: "pendingReview" as const, label: "Pending Review", href: "/curation", color: "text-amber-600 dark:text-amber-400" },
  { key: "productionReady" as const, label: "Production Ready", href: "/production-ready", color: "text-indigo-600 dark:text-indigo-400" },
  { key: "metadataIssues" as const, label: "Metadata Issues", href: "/assets", color: "text-orange-600 dark:text-orange-400" },
  { key: "possibleDuplicates" as const, label: "Possible Duplicates", href: "/assets", color: "text-red-600 dark:text-red-400" },
];

export function DashboardStats() {
  const { stats, aiStats } = useAssets();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statConfig.map(({ key, label, href, color }) => (
          <Link key={key} href={href} className="group">
            <Card className="transition-shadow group-hover:shadow-md">
              <CardContent className="pt-5">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
                <p className={`mt-1 text-3xl font-bold ${color}`}>{stats[key]}</p>
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">Live session data</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">AI-Assisted Reviews</p>
            <p className="mt-1 text-3xl font-bold text-violet-600 dark:text-violet-400">
              {aiStats.aiAssistedReviews}
            </p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Reviews marked with AI assistance this session
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Approved</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.approved}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Needs Changes</p>
            <p className="mt-1 text-3xl font-bold text-orange-600 dark:text-orange-400">
              {stats.needsChanges}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
