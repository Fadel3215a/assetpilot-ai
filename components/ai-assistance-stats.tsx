"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";

export function AIAssistanceStats() {
  const { aiStats } = useAssets();

  const metrics = [
    { label: "Active suggestions", value: aiStats.suggestionsTotal, color: "text-accent", href: "/curation" },
    { label: "Accepted", value: aiStats.accepted, color: "text-status-success", href: "/reviews" },
    { label: "Edited", value: aiStats.edited, color: "text-status-warning", href: "/reviews" },
    { label: "Dismissed", value: aiStats.dismissed, color: "text-muted", href: "/reviews" },
    { label: "AI-assisted reviews", value: aiStats.aiAssistedReviews, color: "text-accent", href: "/reviews" },
  ];

  return (
    <div>
      <h2 id="ai-assistance-heading" className="section-label mb-1">
        AI Assistance
      </h2>
      <p className="mb-6 text-xs text-muted">
        Simulated AI metrics — supporting information; human curator remains in control
      </p>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(({ label, value, color, href }) => (
          <div key={label}>
            <Link href={href} className="group block">
              <dt className="text-xs text-muted group-hover:text-foreground">{label}</dt>
              <dd className={`mt-1 text-2xl font-semibold tracking-tight ${color}`}>{value}</dd>
            </Link>
          </div>
        ))}
      </dl>
    </div>
  );
}
