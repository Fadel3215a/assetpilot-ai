import { productionSuggestionLabel } from "@/lib/generate-ai-analysis";
import type { AIAnalysis } from "@/types";
import { SourceBadge } from "./ui/source-badge";
import { Card, CardContent } from "./ui/card";

interface AIReadinessSummaryProps {
  analysis: AIAnalysis;
}

export function AIReadinessSummary({ analysis }: AIReadinessSummaryProps) {
  const prod = analysis.productionSuggestion;

  return (
    <Card className="panel-ai">
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center gap-2">
          <SourceBadge source="ai" />
          <p className="section-label">AI Readiness Suggestion</p>
        </div>
        <p className="text-sm text-foreground">{prod.summary}</p>
        <p className="text-sm font-medium text-foreground">
          AI recommendation: {productionSuggestionLabel(prod.recommendation)}
        </p>
        <p className="text-xs text-muted">Why? {prod.explanation}</p>
        <p className="text-xs italic text-muted">Simulated analysis — final state from curator checklist</p>
      </CardContent>
    </Card>
  );
}
