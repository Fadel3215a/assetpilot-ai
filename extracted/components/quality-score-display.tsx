import type { QualityScore } from "@/types";

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function barColor(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-red-500";
}

interface QualityScoreDisplayProps {
  score: QualityScore;
  compact?: boolean;
}

export function QualityScoreDisplay({ score, compact = false }: QualityScoreDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Quality</span>
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
        <span className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">/ 100 overall</span>
      </div>
      {metrics.length > 0 && (
        <div className="space-y-2">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">{metric.label}</span>
                <span className="font-medium">{metric.value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{score.notes}</p>
      )}
    </div>
  );
}
