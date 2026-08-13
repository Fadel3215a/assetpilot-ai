"use client";

import { useState } from "react";
import Link from "next/link";
import { useAssets, type ReviewAction } from "@/lib/assets-context";
import { createDefaultChecklist } from "@/lib/quality";
import { getCurrentVersion } from "@/lib/utils";
import { Button } from "./ui/button";

interface ReviewActionsProps {
  assetId: string;
  currentDecision: string;
}

export function ReviewActions({ assetId, currentDecision }: ReviewActionsProps) {
  const { submitReview, getAsset } = useAssets();
  const [notes, setNotes] = useState("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const asset = getAsset(assetId);
  const version = asset ? getCurrentVersion(asset) : null;
  const checklist = version?.curatorChecklist ?? createDefaultChecklist();

  function handleAction(action: ReviewAction) {
    setError(null);
    const result = submitReview(assetId, { action, notes: notes || undefined, checklist });
    if (!result.ok) {
      setError(result.error ?? "Unable to submit.");
      return;
    }
    setLastAction(action);
    setNotes("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="section-title">
          Curator Review
        </h3>
        <p className="mt-1 text-xs text-muted">
          Human judgment drives approval decisions. Changes apply to this session only.
        </p>
        <Link
          href={`/curation/${assetId}`}
          className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
        >
          Open full review workspace →
        </Link>
      </div>

      <div>
        <label htmlFor="review-notes" className="mb-1.5 block text-sm text-muted">
          Curator notes
        </label>
        <textarea
          id="review-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add curator notes for this decision..."
          className="field-textarea"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="success" onClick={() => handleAction("APPROVED")} aria-label="Approve asset">
          Approve
        </Button>
        <Button variant="secondary" onClick={() => handleAction("CHANGES_REQUESTED")} aria-label="Request changes on asset">
          Request Changes
        </Button>
        <Button variant="danger" onClick={() => handleAction("REJECTED")} aria-label="Reject asset">
          Reject
        </Button>
      </div>

      {error && <p className="text-sm text-status-danger" role="alert">{error}</p>}

      {lastAction && (
        <p className="text-sm text-status-success" role="status">
          Decision recorded: {lastAction.replace("_", " ").toLowerCase()} (session only)
        </p>
      )}

      <p className="text-xs text-muted">
        Current review state: {currentDecision.replace("_", " ").toLowerCase()}
      </p>
    </div>
  );
}
