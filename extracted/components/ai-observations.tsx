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
    return <p className="text-sm text-zinc-500">No pending observations.</p>;
  }

  return (
    <ul className="space-y-2">
      {active.map((obs) => (
        <li
          key={obs.id}
          className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 dark:border-violet-900/40 dark:bg-violet-950/20"
        >
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            <span className="mr-1 text-amber-500" aria-hidden="true">⚠</span>
            {obs.text}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Why? {obs.explanation}</p>
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
