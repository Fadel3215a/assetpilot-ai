"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { Card, CardContent } from "./ui/card";

const attentionStats = [
  {
    key: "pendingReview" as const,
    label: "Pending Review",
    href: "/curation",
    color: "text-status-warning",
    hint: "Needs curator attention",
  },
  {
    key: "metadataIssues" as const,
    label: "Metadata Issues",
    href: "/assets?focus=metadata",
    color: "text-status-warning",
    hint: "Incomplete metadata or tags",
  },
  {
    key: "possibleDuplicates" as const,
    label: "Possible Duplicates",
    href: "/assets?focus=duplicates",
    color: "text-status-danger",
    hint: "Metadata-based matches",
  },
];

const secondaryStats = [
  {
    key: "productionReady" as const,
    label: "Production Ready",
    href: "/production-ready",
    color: "text-status-success",
    hint: "Passed curator checklist",
  },
  {
    key: "total" as const,
    label: "Total Assets",
    href: "/assets",
    color: "text-foreground",
    hint: "All assets in session",
  },
  {
    key: "approved" as const,
    label: "Approved",
    href: "/reviews",
    color: "text-status-success",
    hint: "Curator approvals",
  },
  {
    key: "needsChanges" as const,
    label: "Needs Changes",
    href: "/assets?focus=metadata",
    color: "text-status-warning",
    hint: "Awaiting curator revision",
  },
];

export function DashboardStats() {
  const { stats, aiStats } = useAssets();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {attentionStats.map(({ key, label, href, color, hint }) => (
          <Link key={key} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-accent/30">
              <CardContent className="pt-4">
                <p className="text-xs text-muted">{label}</p>
                <p className={`stat-primary mt-1 ${color}`}>{stats[key]}</p>
                <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {secondaryStats.map(({ key, label, href, color, hint }) => (
          <Link key={key} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-border">
              <CardContent className="pt-4">
                <p className="text-xs text-muted">{label}</p>
                <p className={`stat-secondary mt-1 ${color}`}>{stats[key]}</p>
                <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        <Link href="/reviews" className="group">
          <Card className="h-full transition-colors group-hover:border-accent/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted">AI-Assisted Reviews</p>
              <p className="stat-secondary mt-1 text-accent">{aiStats.aiAssistedReviews}</p>
              <p className="mt-1.5 text-[11px] text-muted">
                Reviews opened with AI assistance this session
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
