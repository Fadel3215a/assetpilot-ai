import { calculateCuratorScore } from "@/lib/quality";
import type { QualityCriterion } from "@/types";

interface CuratorScoreDisplayProps {
  checklist: QualityCriterion[];
}

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function CuratorScoreDisplay({ checklist }: CuratorScoreDisplayProps) {
  const score = calculateCuratorScore(checklist);
  const passCount = checklist.filter((c) => c.rating === "PASS").length;
  const failCount = checklist.filter((c) => c.rating === "FAIL").length;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Curator Quality Score
      </p>
      <div className="mt-1 flex items-end gap-2">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">/ 100</span>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Calculated from checklist: Pass = 100, Needs Review = 50, Fail = 0 (average)
      </p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        {passCount} pass · {checklist.length - passCount - failCount} needs review · {failCount} fail
      </p>
    </div>
  );
}
