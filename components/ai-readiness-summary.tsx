import { productionSuggestionLabel } from "@/lib/generate-ai-analysis";
import type { AIAnalysis } from "@/types";
import { Card, CardContent } from "./ui/card";

interface AIReadinessSummaryProps {
  analysis: AIAnalysis;
}

export function AIReadinessSummary({ analysis }: AIReadinessSummaryProps) {
  const prod = analysis.productionSuggestion;

  return (
    <Card className="border-violet-200 bg-violet-50/30 dark:border-violet-900/50 dark:bg-violet-950/10">
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-600 text-[10px] font-bold text-white">
            AI
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
            AI Readiness Suggestion
          </p>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{prod.summary}</p>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          AI recommendation: {productionSuggestionLabel(prod.recommendation)}
        </p>
        <p className="text-xs text-zinc-500">Why? {prod.explanation}</p>
        <p className="text-xs italic text-zinc-400">Simulated analysis — final state from curator checklist</p>
      </CardContent>
    </Card>
  );
}
