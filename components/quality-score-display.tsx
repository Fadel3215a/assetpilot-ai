import type { QualityScore } from "@/types";

function scoreColor(score: number): string {
  if (score >= 85) return "text-status-success";
  if (score >= 70) return "text-status-warning";
  return "text-status-danger";
}

function barColor(score: number): string {
  if (score >= 85) return "bg-status-success";
  if (score >= 70) return "bg-status-warning";
  return "bg-status-danger";
}

interface QualityScoreDisplayProps {
  score: QualityScore;
  compact?: boolean;
}

export function QualityScoreDisplay({ score, compact = false }: QualityScoreDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Quality</span>
        <span className={`text-sm font-semibold ${scoreColor(score.overall)}`}>
          {score.overall}
        </span>
      </div>
    );
  }

  const metrics = [
    { label: "Visual clarity", value: score.visualClarity },
    { label: "Consistency", value: score.consistency },
    { label: "Technical", value: score.technicalQuality },
    { label: "Brand alignment", value: score.brandAlignment },
  ].filter((m) => m.value !== undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold ${scoreColor(score.overall)}`}>
          {score.overall}
        </span>
        <span className="mb-1 text-sm text-muted">/ 100 overall</span>
      </div>
      {metrics.length > 0 && (
        <div className="space-y-2">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted">{metric.label}</span>
                <span className="font-medium">{metric.value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className={`h-full rounded-full ${barColor(metric.value!)}`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {score.notes && (
        <p className="text-sm text-muted">{score.notes}</p>
      )}
    </div>
  );
}
