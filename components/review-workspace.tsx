"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { notFound } from "next/navigation";
import { useAssets, type ReviewAction } from "@/lib/assets-context";
import { createDefaultChecklist, isMetadataComplete, metadataCompleteness } from "@/lib/quality";
import {
  assetTypeLabel,
  findComparisonPartner,
  formatDate,
  formatFileSize,
  getCurrentVersion,
  statusLabel,
} from "@/lib/utils";
import { AssetMediaPreview } from "./asset-media-preview";
import { AIInsightPanel } from "./ai-insight-panel";
import { CuratorScoreDisplay } from "./curator-score-display";
import { DecisionHistoryPanel } from "./decision-history-panel";
import { QualityChecklist } from "./quality-checklist";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { SourceBadge } from "./ui/source-badge";
import type { QualityCriterion } from "@/types";

export function ReviewWorkspace({ assetId }: { assetId: string }) {
  const router = useRouter();
  const { getAsset, collections, submitReview, updateCuratorChecklist, assets } = useAssets();
  const asset = getAsset(assetId);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!asset) {
    notFound();
  }

  const version = getCurrentVersion(asset);
  const collection = collections.find((c) => c.id === asset.collectionId);
  const checklist: QualityCriterion[] =
    version.curatorChecklist ?? createDefaultChecklist();

  const handleRatingChange = useCallback(
    (criterionId: string, rating: QualityCriterion["rating"]) => {
      updateCuratorChecklist(assetId, criterionId, rating);
    },
    [assetId, updateCuratorChecklist],
  );

  function handleAction(action: ReviewAction) {
    setError(null);
    setSuccess(null);
    const result = submitReview(assetId, { action, notes: notes || undefined, checklist });
    if (!result.ok) {
      setError(result.error ?? "Unable to submit review.");
      return;
    }
    setSuccess(`Decision recorded: ${action.replace(/_/g, " ").toLowerCase()}`);
    setNotes("");
  }

  const metadataComplete = isMetadataComplete(version.metadata);
  const metaScore = metadataCompleteness(version.metadata);
  const comparePartnerId = findComparisonPartner(assets, assetId);

  return (
    <div className="space-y-6">
      <div className="panel-ai px-4 py-3 text-sm text-foreground">
        <span className="font-semibold text-accent">AI suggests. You decide.</span>{" "}
        Simulated AI-Assisted Analysis appears below. Curator Evaluation and final
        Approve / Request Changes / Reject actions are separate.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/curation" className="link-subtle inline-flex items-center gap-1">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Curation Queue
        </Link>
        <div className="flex flex-wrap gap-2">
          {comparePartnerId && (
            <Link href={`/compare?a=${assetId}&b=${comparePartnerId}`}>
              <Button variant="secondary">Compare Assets</Button>
            </Link>
          )}
          <Link href={`/production-ready?asset=${assetId}`}>
            <Button variant="ghost">Production Readiness</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="overflow-hidden p-0">
            <AssetMediaPreview asset={asset} className="aspect-video w-full" priority />
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={asset.status} />
                <SourceBadge source="ai" />
                <span className="text-sm text-muted">
                  {assetTypeLabel(asset.type)} · v{version.versionNumber}
                </span>
              </div>
              <h2 className="mt-2 text-xl font-semibold text-foreground">{asset.name}</h2>
              <p className="mt-1.5 text-sm text-muted">{version.metadata.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="section-title">Metadata Check</h3>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <span
                  className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${
                    metadataComplete
                      ? "border-status-success/30 bg-status-success-muted text-status-success"
                      : "border-status-warning/30 bg-status-warning-muted text-status-warning"
                  }`}
                >
                  {metadataComplete ? "Metadata complete" : "Missing metadata fields"}
                </span>
                <span className="text-xs text-muted">{metaScore}% complete</span>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="meta-label">Format</dt>
                  <dd className="meta-value">{version.metadata.format}</dd>
                </div>
                <div>
                  <dt className="meta-label">File size</dt>
                  <dd className="meta-value">{formatFileSize(version.metadata.fileSize)}</dd>
                </div>
                {version.metadata.generator && (
                  <div>
                    <dt className="meta-label">Generator</dt>
                    <dd className="meta-value">{version.metadata.generator}</dd>
                  </div>
                )}
                <div>
                  <dt className="meta-label">Updated</dt>
                  <dd className="meta-value">{formatDate(version.metadata.updatedAt)}</dd>
                </div>
              </dl>
              {version.metadata.prompt && (
                <p className="mt-3 rounded-md border border-border bg-surface-elevated p-3 text-sm text-foreground">
                  <span className="text-xs text-muted">Prompt: </span>
                  {version.metadata.prompt}
                </p>
              )}
            </CardContent>
          </Card>

          <AIInsightPanel asset={asset} />

          <DecisionHistoryPanel history={asset.decisionHistory} />
        </div>

        <div className="space-y-4">
          <div className="panel-curator">
            <p className="section-label border-b border-border px-4 py-2.5">
              Curator Evaluation
            </p>
            <div className="space-y-4 p-4">
              <CuratorScoreDisplay checklist={checklist} />
              <QualityChecklist checklist={checklist} onRatingChange={handleRatingChange} />
            </div>
          </div>

          <Card>
            <CardHeader>
              <h3 className="section-title">Organization</h3>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {collection && (
                <div>
                  <p className="meta-label">Collection</p>
                  <Badge color={collection.color} className="mt-1">{collection.name}</Badge>
                </div>
              )}
              <div>
                <p className="meta-label">Tags</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {asset.tags.map((tag) => (
                    <span key={tag} className="tag-muted">{tag}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="meta-label">Status</p>
                <p className="meta-value">{statusLabel(asset.status)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="section-title">Curator Decision</h3>
              <p className="mt-0.5 text-xs text-muted">
                Human-in-the-loop — explain your judgment
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="curator-notes" className="meta-label mb-1.5 block">
                  Curator notes
                </label>
                <textarea
                  id="curator-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain why you approve, reject, or request changes..."
                  className="field-textarea"
                />
                <p className="mt-1 text-xs text-muted">
                  Required for Reject and Request Changes
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="success" onClick={() => handleAction("APPROVED")} aria-label="Approve asset">
                  Approve
                </Button>
                <Button variant="secondary" onClick={() => handleAction("CHANGES_REQUESTED")} aria-label="Request changes">
                  Request Changes
                </Button>
                <Button variant="danger" onClick={() => handleAction("REJECTED")} aria-label="Reject asset">
                  Reject
                </Button>
              </div>

              {error && (
                <p className="text-sm text-status-danger" role="alert">{error}</p>
              )}
              {success && (
                <p className="text-sm text-status-success" role="status">{success}</p>
              )}

              <Button variant="ghost" className="w-full" onClick={() => router.push("/curation")}>
                Return to Queue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
