type SourceType = "ai" | "curator" | "system";

const styles: Record<SourceType, string> = {
  ai: "bg-status-ai-muted text-status-ai border-status-ai/20",
  curator: "bg-surface-elevated text-foreground border-border",
  system: "bg-status-neutral-muted text-status-neutral border-border",
};

const labels: Record<SourceType, string> = {
  ai: "AI",
  curator: "Curator",
  system: "System",
};

export function SourceBadge({ source }: { source: SourceType }) {
  return (
    <span
      className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[source]}`}
    >
      {labels[source]}
    </span>
  );
}
