"use client";

interface HybridSearchDialProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function blendLabel(value: number): string {
  const vectorPct = Math.round(value * 100);
  return `${vectorPct}% Vector`;
}

/**
 * Stage 1.2 — Interactive vector-vs-text blend dial for hybrid search.
 *
 * A single slider controls the fused-score weighting passed to /api/search
 * (0% Vector → 100% Text on the left, 100% Vector on the right). Framer-motion
 * animates the thumb position and the trailing "Vector" fill as it moves.
 */
export function HybridSearchDial({ value, onChange, disabled = false }: HybridSearchDialProps) {
  const pct = Math.round(value * 100);

  return (
    <div
      className={`rounded-md border border-border bg-surface p-3 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Hybrid blend
        </span>
        <span className="text-xs font-semibold text-accent" aria-live="polite">
          {blendLabel(value)}
        </span>
      </div>

      <div className="mt-2.5">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          disabled={disabled}
          aria-label="Vector-to-text search blend"
          aria-valuetext={`${vectorPctText(value)}`}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="h-2 w-full cursor-pointer accent-accent"
        />
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted">
          <span>0% Vector · 100% Text</span>
          <span>100% Vector</span>
        </div>
      </div>
    </div>
  );
}

function vectorPctText(value: number): string {
  const pct = Math.round(value * 100);
  return `${pct}% vector, ${100 - pct}% text`;
}