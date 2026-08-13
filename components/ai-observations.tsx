"use client";

import { useAssets } from "@/lib/assets-context";
import { Button } from "./ui/button";
import type { AIQualityObservation } from "@/types";

interface AIObservationsProps {
  assetId: string;
  observations: AIQualityObservation[];
  dismissedIds: string[];
}

export function AIObservations({ assetId, observations, dismissedIds }: AIObservationsProps) {
  const { acceptObservation, dismissObservation } = useAssets();

  const active = observations.filter((o) => !dismissedIds.includes(o.id));

  if (active.length === 0) {
    return <p className="text-sm text-muted">No pending observations.</p>;
  }

  return (
    <ul className="space-y-2">
      {active.map((obs) => (
        <li key={obs.id} className="panel-ai p-3">
          <p className="text-sm text-foreground">
            <span className="mr-1 text-status-warning" aria-hidden="true">⚠</span>
            {obs.text}
          </p>
          <p className="mt-1 text-xs text-muted">Why? {obs.explanation}</p>
          <div className="mt-2 flex gap-1.5">
            <Button variant="success" className="px-2 py-1 text-xs" onClick={() => acceptObservation(assetId, obs.id)}>
              Accept Observation
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => dismissObservation(assetId, obs.id)}>
              Dismiss
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
