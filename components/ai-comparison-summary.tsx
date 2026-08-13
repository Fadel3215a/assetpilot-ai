import type { AIComparisonSummary } from "@/types";
import { SourceBadge } from "./ui/source-badge";
import { Card, CardContent, CardHeader } from "./ui/card";

interface AIComparisonSummaryPanelProps {
  summary: AIComparisonSummary;
}

export function AIComparisonSummaryPanel({ summary }: AIComparisonSummaryPanelProps) {
  return (
    <Card className="panel-ai">
      <CardHeader>
        <div className="flex items-center gap-2">
          <SourceBadge source="ai" />
          <div>
            <h3 className="section-title">AI Comparison Summary</h3>
            <p className="text-xs text-accent">AI Suggestion Only — curator makes final decision</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="section-label">Asset A strengths</p>
            <ul className="mt-1 space-y-0.5">
              {summary.assetAStrengths.map((s) => (
                <li key={s} className="text-sm text-foreground">✓ {s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="section-label">Asset B strengths</p>
            <ul className="mt-1 space-y-0.5">
              {summary.assetBStrengths.map((s) => (
                <li key={s} className="text-sm text-foreground">✓ {s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <p className="section-label">Key differences</p>
          <ul className="mt-1 space-y-0.5">
            {summary.keyDifferences.map((d) => (
              <li key={d} className="text-sm text-foreground">{d}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="section-label">Potential concerns</p>
          <ul className="mt-1 space-y-0.5">
            {summary.potentialConcerns.map((c) => (
              <li key={c} className="text-sm text-status-warning">⚠ {c}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-border bg-surface-elevated p-3">
          <p className="text-xs font-medium text-accent">Suggested direction</p>
          <p className="mt-1 text-sm text-foreground">{summary.suggestedDirection}</p>
          <p className="mt-1 text-xs text-muted">{summary.explanation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
