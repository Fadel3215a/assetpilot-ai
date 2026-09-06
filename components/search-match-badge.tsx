import type { AssetSearchHit } from "@/types";

function signalHints(hit: AssetSearchHit) {
  const hasVector = hit.matchedBy.includes("vector");
  const hasText = hit.matchedBy.includes("fulltext");
  if (hasVector && hasText) {
    return {
      label: "Hybrid",
      hint: "Matched by both vector similarity and full-text search",
      classes: "border-accent/30 bg-accent/10 text-accent",
    };
  }
  if (hasVector) {
    return {
      label: "Vector",
      hint: "Matched by vector embedding similarity",
      classes: "border-status-success/20 bg-status-success-muted text-status-success",
    };
  }
  return {
    label: "Text",
    hint: "Matched by full-text search",
    classes: "border-status-warning/20 bg-status-warning-muted text-status-warning",
  };
}

/**
 * Stage 4.2 — Hybrid search match badge. Shows which retrieval signal(s) a
 * result hit (Vector / Text / Hybrid) plus the fused confidence percentage.
 */
export function SearchMatchBadge({ hit }: { hit: AssetSearchHit }) {
  const signal = signalHints(hit);
  const confidence = Math.round(Math.min(1, Math.max(0, hit.score)) * 100);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${signal.classes}`}
      title={`${signal.hint} · ${confidence}% confidence`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {signal.label}
      <span className="opacity-80">{confidence}%</span>
    </span>
  );
}