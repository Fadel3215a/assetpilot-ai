"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";

const attentionItems = [
  {
    key: "pendingReview" as const,
    label: "Pending Review",
    href: "/curation",
    color: "text-status-warning",
  },
  {
    key: "metadataIssues" as const,
    label: "Metadata Issues",
    href: "/assets?focus=metadata",
    color: "text-status-warning",
  },
  {
    key: "possibleDuplicates" as const,
    label: "Possible Duplicates",
    href: "/assets?focus=duplicates",
    color: "text-status-danger",
  },
];

export function DashboardAttention() {
  const { stats } = useAssets();

  return (
    <div className="grid gap-0 sm:grid-cols-3 sm:divide-x sm:divide-border">
      {attentionItems.map(({ key, label, href, color }) => (
        <Link key={key} href={href} className="attention-stat px-0 sm:px-8 first:sm:pl-0 last:sm:pr-0">
          <p className="section-label">{label}</p>
          <p className={`attention-stat-value mt-2 ${color}`}>{stats[key]}</p>
        </Link>
      ))}
    </div>
  );
}
