"use client";

import { useState } from "react";
import { useAssets } from "@/lib/assets-context";
import { Button } from "./ui/button";
import { Select } from "./ui/select";

interface AICollectionSuggestionProps {
  assetId: string;
  suggestedCollectionId: string;
  explanation: string;
  currentCollectionId: string;
}

export function AICollectionSuggestion({
  assetId,
  suggestedCollectionId,
  explanation,
  currentCollectionId,
}: AICollectionSuggestionProps) {
  const { collections, acceptCollectionSuggestion } = useAssets();
  const [changing, setChanging] = useState(false);
  const [selectedId, setSelectedId] = useState(suggestedCollectionId);

  const suggested = collections.find((c) => c.id === suggestedCollectionId);
  const isAlreadyInSuggested = currentCollectionId === suggestedCollectionId;

  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
      <p className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
        AI Suggestion
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {suggested?.name ?? "Suggested collection"}
      </p>
      <p className="mt-1 text-xs text-zinc-500">Why? {explanation}</p>

      {changing ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Choose collection">
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button
            variant="primary"
            className="text-xs"
            onClick={() => {
              acceptCollectionSuggestion(assetId, selectedId);
              setChanging(false);
            }}
          >
            Confirm
          </Button>
          <Button variant="ghost" className="text-xs" onClick={() => setChanging(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!isAlreadyInSuggested && (
            <Button
              variant="success"
              className="text-xs"
              onClick={() => acceptCollectionSuggestion(assetId, suggestedCollectionId)}
            >
              Accept
            </Button>
          )}
          <Button variant="secondary" className="text-xs" onClick={() => setChanging(true)}>
            Change
          </Button>
          {isAlreadyInSuggested && (
            <span className="self-center text-xs text-emerald-600 dark:text-emerald-400">
              Already in this collection
            </span>
          )}
        </div>
      )}
    </div>
  );
}
