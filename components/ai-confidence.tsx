import type { AIConfidenceLevel } from "@/types";
import { confidenceLabel } from "@/lib/generate-ai-analysis";

const styles: Record<AIConfidenceLevel, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function AIConfidence({ level }: { level: AIConfidenceLevel }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">AI Suggestion Confidence</p>
      <span className={`mt-1 inline-flex rounded-md px-2.5 py-0.5 text-xs font-medium ${styles[level]}`}>
        {confidenceLabel(level)} — demo confidence
      </span>
      <p className="mt-1 text-xs text-zinc-400">Not calibrated model probability</p>
    </div>
  );
}
