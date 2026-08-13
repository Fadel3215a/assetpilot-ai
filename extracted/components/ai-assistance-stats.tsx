"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { Card, CardContent } from "./ui/card";

export function AIAssistanceStats() {
  const { aiStats } = useAssets();

  const cards = [
    { label: "AI Suggestions (active)", value: aiStats.suggestionsTotal, color: "text-violet-600", href: "/curation" },
    { label: "Accepted", value: aiStats.accepted, color: "text-emerald-600", href: "/reviews" },
    { label: "Edited", value: aiStats.edited, color: "text-amber-600", href: "/reviews" },
    { label: "Dismissed", value: aiStats.dismissed, color: "text-zinc-600", href: "/reviews" },
    { label: "AI-Assisted Reviews", value: aiStats.aiAssistedReviews, color: "text-indigo-600", href: "/reviews" },
  ];

  return (
    <div>
      <h2 id="ai-assistance-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        AI Assistance
      </h2>
      <p className="mb-4 text-xs text-zinc-500">
        Simulated AI metrics from the current session — human curator remains in control
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardContent className="pt-5">
                <p className="text-sm text-zinc-500">{card.label}</p>
                <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
