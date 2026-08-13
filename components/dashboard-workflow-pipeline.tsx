import Link from "next/link";

const pipelineSteps = [
  { label: "Ingest", href: "/assets", description: "Upload & import" },
  { label: "Metadata", href: "/assets", description: "Extract & edit" },
  { label: "AI Analysis", href: "/curation", description: "Simulated assist" },
  { label: "Human Review", href: "/curation", description: "Curator evaluates" },
  { label: "Comparison", href: "/compare", description: "Art direction" },
  { label: "Decision", href: "/reviews", description: "Approve or reject" },
  { label: "Production", href: "/production-ready", description: "Final gate" },
];

export function DashboardWorkflowPipeline() {
  return (
    <ol className="pipeline-track">
      {pipelineSteps.map((step, i) => (
        <li key={step.label} className="flex flex-1">
          <Link href={step.href} className="pipeline-step w-full">
            <span className="pipeline-step-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-medium text-foreground">{step.label}</span>
            <span className="text-xs text-muted">{step.description}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
