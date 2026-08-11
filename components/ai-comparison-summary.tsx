import type { AIComparisonSummary } from "@/types";
import { Card, CardContent, CardHeader } from "./ui/card";

interface AIComparisonSummaryPanelProps {
  summary: AIComparisonSummary;
}

export function AIComparisonSummaryPanel({ summary }: AIComparisonSummaryPanelProps) {
  return (
    <Card className="border-violet-200 bg-violet-50/30 dark:border-violet-900/50 dark:bg-violet-950/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600 text-xs font-bold text-white">
            AI
          </span>
          <div>
            <h3 className="text-sm font-semibold">AI Comparison Summary</h3>
            <p className="text-xs text-violet-600 dark:text-violet-400">AI Suggestion Only — curator makes final decision</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-zinc-500">Asset A strengths</p>
            <ul className="mt-1 space-y-0.5">
              {summary.assetAStrengths.map((s) => (
                <li key={s} className="text-sm text-zinc-700 dark:text-zinc-300">✓ {s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Asset B strengths</p>
            <ul className="mt-1 space-y-0.5">
              {summary.assetBStrengths.map((s) => (
                <li key={s} className="text-sm text-zinc-700 dark:text-zinc-300">✓ {s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-500">Key differences</p>
          <ul className="mt-1 space-y-0.5">
            {summary.keyDifferences.map((d) => (
              <li key={d} className="text-sm text-zinc-700 dark:text-zinc-300">{d}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-500">Potential concerns</p>
          <ul className="mt-1 space-y-0.5">
            {summary.potentialConcerns.map((c) => (
              <li key={c} className="text-sm text-amber-700 dark:text-amber-400">⚠ {c}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-violet-100 bg-white/60 p-3 dark:border-violet-900/30 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Suggested direction</p>
          <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{summary.suggestedDirection}</p>
          <p className="mt-1 text-xs text-zinc-500">{summary.explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
