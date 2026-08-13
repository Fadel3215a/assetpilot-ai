"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { Card, CardContent } from "./ui/card";

export function AIAssistanceStats() {
  const { aiStats } = useAssets();

  const cards = [
    { label: "AI Suggestions (active)", value: aiStats.suggestionsTotal, color: "text-accent", href: "/curation" },
    { label: "Accepted", value: aiStats.accepted, color: "text-status-success", href: "/reviews" },
    { label: "Edited", value: aiStats.edited, color: "text-status-warning", href: "/reviews" },
    { label: "Dismissed", value: aiStats.dismissed, color: "text-muted", href: "/reviews" },
    { label: "AI-Assisted Reviews", value: aiStats.aiAssistedReviews, color: "text-accent", href: "/reviews" },
  ];

  return (
    <div>
      <h2 id="ai-assistance-heading" className="section-label mb-1">
        AI Assistance
      </h2>
      <p className="mb-4 text-xs text-muted">
        Simulated AI metrics from the current session — human curator remains in control
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="group">
            <Card className="h-full border-border transition-colors group-hover:border-accent/20">
              <CardContent className="pt-4">
                <p className="text-xs text-muted">{card.label}</p>
                <p className={`stat-secondary mt-1 ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
