"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { Card, CardContent } from "./ui/card";

const statConfig = [
  { key: "total" as const, label: "Total Assets", href: "/assets", color: "text-zinc-900 dark:text-zinc-50" },
  { key: "pendingReview" as const, label: "Pending Review", href: "/curation", color: "text-amber-600 dark:text-amber-400" },
  { key: "approved" as const, label: "Approved", href: "/reviews", color: "text-emerald-600 dark:text-emerald-400" },
  { key: "needsChanges" as const, label: "Needs Changes", href: "/assets?status=CHANGES_REQUESTED", color: "text-orange-600 dark:text-orange-400" },
  { key: "productionReady" as const, label: "Production Ready", href: "/production-ready", color: "text-indigo-600 dark:text-indigo-400" },
];

export function DashboardStats() {
  const { stats } = useAssets();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {statConfig.map(({ key, label, href, color }) => (
        <Link key={key} href={href} className="group">
          <Card className="transition-shadow group-hover:shadow-md">
            <CardContent className="pt-5">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className={`mt-1 text-3xl font-bold ${color}`}>{stats[key]}</p>
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">Demo mock data</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
