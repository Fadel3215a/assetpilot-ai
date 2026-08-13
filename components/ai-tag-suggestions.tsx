"use client";

import { useState } from "react";
import { useAssets } from "@/lib/assets-context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { AITagSuggestion } from "@/types";

interface AITagSuggestionsProps {
  assetId: string;
  suggestions: AITagSuggestion[];
  dismissedIds: string[];
}

export function AITagSuggestions({ assetId, suggestions, dismissedIds }: AITagSuggestionsProps) {
  const { acceptTagSuggestion, editTagSuggestion, dismissTagSuggestion } = useAssets();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const active = suggestions.filter((s) => !dismissedIds.includes(s.id));

  if (active.length === 0) {
    return <p className="text-sm text-muted">No pending tag suggestions.</p>;
  }

  return (
    <ul className="space-y-3">
      {active.map((s) => (
        <li key={s.id} className="panel-ai p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="rounded-sm bg-status-ai-muted px-2 py-0.5 text-sm font-medium text-status-ai">
                {s.tag}
              </span>
              <p className="mt-1 text-xs text-muted">Why? {s.explanation}</p>
            </div>
          </div>
          {editingId === s.id ? (
            <div className="mt-2 flex gap-2">
              <Input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1"
                aria-label={`Edit tag ${s.tag}`}
              />
              <Button
                variant="primary"
                className="px-2 py-1 text-xs"
                onClick={() => {
                  editTagSuggestion(assetId, s.id, editValue);
                  setEditingId(null);
                }}
              >
                Apply
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button variant="success" className="px-2 py-1 text-xs" onClick={() => acceptTagSuggestion(assetId, s.id)}>
                Accept
              </Button>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => {
                  setEditingId(s.id);
                  setEditValue(s.tag);
                }}
              >
                Edit
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => dismissTagSuggestion(assetId, s.id)}>
                Dismiss
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
