import type { ChecklistRating, QualityCriterion } from "@/types";
import { ratingLabel } from "@/lib/quality";

interface QualityChecklistProps {
  checklist: QualityCriterion[];
  onRatingChange: (criterionId: string, rating: ChecklistRating) => void;
  disabled?: boolean;
}

const ratings: ChecklistRating[] = ["PASS", "NEEDS_REVIEW", "FAIL"];

const ratingStyles: Record<ChecklistRating, string> = {
  PASS: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  FAIL: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
};

export function QualityChecklist({
  checklist,
  onRatingChange,
  disabled = false,
}: QualityChecklistProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Quality Checklist
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Curator evaluation criteria — not automated AI scoring
        </p>
      </div>
      <ul className="space-y-2">
        {checklist.map((criterion) => (
          <li
            key={criterion.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-100 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
          >
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {criterion.label}
            </span>
            <div className="flex gap-1.5" role="group" aria-label={`Rate ${criterion.label}`}>
              {ratings.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  disabled={disabled}
                  onClick={() => onRatingChange(criterion.id, rating)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    criterion.rating === rating
                      ? ratingStyles[rating]
                      : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                  aria-pressed={criterion.rating === rating}
                >
                  {ratingLabel(rating)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
