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
      <p className="rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-200">
        <span className="font-semibold">AI suggests. You decide.</span> Simulated AI-Assisted Analysis appears
        below. Curator Evaluation and final Approve / Request Changes / Reject actions are separate.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/curation"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
        >
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
          <Card className="overflow-hidden">
            <AssetMediaPreview asset={asset} className="aspect-video w-full" priority />
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={asset.status} />
                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  AI Generated
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {assetTypeLabel(asset.type)} · v{version.versionNumber}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {asset.name}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {version.metadata.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Metadata Check</h3>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    metadataComplete
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {metadataComplete ? "Metadata complete" : "Missing metadata fields"}
                </span>
                <span className="text-xs text-zinc-500">{metaScore}% complete</span>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Format</dt>
                  <dd className="font-medium">{version.metadata.format}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">File size</dt>
                  <dd className="font-medium">{formatFileSize(version.metadata.fileSize)}</dd>
                </div>
                {version.metadata.generator && (
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">Generator</dt>
                    <dd className="font-medium">{version.metadata.generator}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Updated</dt>
                  <dd className="font-medium">{formatDate(version.metadata.updatedAt)}</dd>
                </div>
              </dl>
              {version.metadata.prompt && (
                <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                  <span className="text-xs text-zinc-500">Prompt: </span>
                  {version.metadata.prompt}
                </p>
              )}
            </CardContent>
          </Card>

          <AIInsightPanel asset={asset} />

          <DecisionHistoryPanel history={asset.decisionHistory} />
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border-2 border-zinc-200 bg-zinc-50/50 p-1 dark:border-zinc-700 dark:bg-zinc-900/30">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Curator Evaluation
            </p>
            <div className="space-y-4 p-3">
          <Card>
            <CardContent className="pt-5">
              <CuratorScoreDisplay checklist={checklist} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <QualityChecklist checklist={checklist} onRatingChange={handleRatingChange} />
            </CardContent>
          </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Organization</h3>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {collection && (
                <div>
                  <p className="text-xs text-zinc-500">Collection</p>
                  <Badge color={collection.color} className="mt-1">{collection.name}</Badge>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500">Tags</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {asset.tags.map((tag) => (
                    <span key={tag} className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Status</p>
                <p className="font-medium">{statusLabel(asset.status)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Curator Decision</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Human-in-the-loop — explain your judgment
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="curator-notes" className="mb-1.5 block text-sm text-zinc-600 dark:text-zinc-400">
                  Curator notes
                </label>
                <textarea
                  id="curator-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain why you approve, reject, or request changes..."
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                />
                <p className="mt-1 text-xs text-zinc-400">
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
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
              )}
              {success && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">{success}</p>
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
