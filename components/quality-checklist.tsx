import type { ChecklistRating, QualityCriterion } from "@/types";
import { ratingLabel } from "@/lib/quality";

interface QualityChecklistProps {
  checklist: QualityCriterion[];
  onRatingChange: (criterionId: string, rating: ChecklistRating) => void;
  disabled?: boolean;
}

const ratings: ChecklistRating[] = ["PASS", "NEEDS_REVIEW", "FAIL"];

const ratingStyles: Record<ChecklistRating, string> = {
  PASS: "border-status-success/40 bg-status-success-muted text-status-success",
  NEEDS_REVIEW: "border-status-warning/40 bg-status-warning-muted text-status-warning",
  FAIL: "border-status-danger/40 bg-status-danger-muted text-status-danger",
};

export function QualityChecklist({
  checklist,
  onRatingChange,
  disabled = false,
}: QualityChecklistProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="section-title">Quality Checklist</h3>
        <p className="mt-0.5 text-xs text-muted">
          Curator evaluation criteria — not automated AI scoring
        </p>
      </div>
      <ul className="space-y-2">
        {checklist.map((criterion) => (
          <li
            key={criterion.id}
            className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium text-foreground">
              {criterion.label}
            </span>
            <div className="flex gap-1.5" role="group" aria-label={`Rate ${criterion.label}`}>
              {ratings.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  disabled={disabled}
                  onClick={() => onRatingChange(criterion.id, rating)}
                  className={`rounded-sm border px-2.5 py-1 text-xs font-medium transition-[transform,background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] hover:-translate-y-px active:translate-y-0 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:transform-none ${
                    criterion.rating === rating
                      ? ratingStyles[rating]
                      : "border-border text-muted hover:bg-surface-elevated hover:text-foreground"
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
