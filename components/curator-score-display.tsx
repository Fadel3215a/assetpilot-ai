import { calculateCuratorScore } from "@/lib/quality";
import type { QualityCriterion } from "@/types";

interface CuratorScoreDisplayProps {
  checklist: QualityCriterion[];
}

function scoreColor(score: number): string {
  if (score >= 85) return "text-status-success";
  if (score >= 70) return "text-status-warning";
  return "text-status-danger";
}

export function CuratorScoreDisplay({ checklist }: CuratorScoreDisplayProps) {
  const score = calculateCuratorScore(checklist);
  const passCount = checklist.filter((c) => c.rating === "PASS").length;
  const failCount = checklist.filter((c) => c.rating === "FAIL").length;

  return (
    <div className="panel-curator p-4">
      <p className="section-label">
        Curator Quality Score
      </p>
      <div className="mt-1 flex items-end gap-2">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="mb-1 text-sm text-muted">/ 100</span>
      </div>
      <p className="mt-2 text-xs text-muted">
        Calculated from checklist: Pass = 100, Needs Review = 50, Fail = 0 (average)
      </p>
      <p className="mt-1 text-xs text-muted">
        {passCount} pass · {checklist.length - passCount - failCount} needs review · {failCount} fail
      </p>
    </div>
  );
}
