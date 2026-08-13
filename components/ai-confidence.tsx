import type { AIConfidenceLevel } from "@/types";
import { confidenceLabel } from "@/lib/generate-ai-analysis";

const styles: Record<AIConfidenceLevel, string> = {
  high: "bg-status-success-muted text-status-success",
  medium: "bg-status-warning-muted text-status-warning",
  low: "bg-status-neutral-muted text-status-neutral",
};

export function AIConfidence({ level }: { level: AIConfidenceLevel }) {
  return (
    <div>
      <p className="text-xs text-muted">AI Suggestion Confidence</p>
      <span className={`mt-1 inline-flex rounded-md px-2.5 py-0.5 text-xs font-medium ${styles[level]}`}>
        {confidenceLabel(level)} — demo confidence
      </span>
      <p className="mt-1 text-xs text-muted">Not calibrated model probability</p>
    </div>
  );
}
