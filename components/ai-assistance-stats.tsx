"use client";

import { useAssets } from "@/lib/assets-context";
import { Card, CardContent } from "./ui/card";

export function AIAssistanceStats() {
  const { aiStats } = useAssets();

  const cards = [
    { label: "AI Suggestions (active)", value: aiStats.suggestionsTotal, color: "text-violet-600" },
    { label: "Accepted", value: aiStats.accepted, color: "text-emerald-600" },
    { label: "Edited", value: aiStats.edited, color: "text-amber-600" },
    { label: "Dismissed", value: aiStats.dismissed, color: "text-zinc-600" },
    { label: "AI-Assisted Reviews", value: aiStats.aiAssistedReviews, color: "text-indigo-600" },
  ];

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        AI Assistance Summary
      </h2>
      <p className="mb-4 text-xs text-zinc-500">
        Demo/session metrics — simulated AI, human curator in control
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-5">
              <p className="text-sm text-zinc-500">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
