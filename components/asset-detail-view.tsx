"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useAssets } from "@/lib/assets-context";
import {
  assetTypeLabel,
  formatDate,
  formatFileSize,
  getCurrentVersion,
  statusLabel,
} from "@/lib/utils";
import { AssetThumbnail } from "./asset-thumbnail";
import { QualityScoreDisplay } from "./quality-score-display";
import { ReviewActions } from "./review-actions";
import { DecisionHistoryPanel } from "./decision-history-panel";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader } from "./ui/card";

export function AssetDetailView({ assetId }: { assetId: string }) {
  const { getAsset, collections } = useAssets();
  const asset = getAsset(assetId);

  if (!asset) {
    notFound();
  }

  const version = getCurrentVersion(asset);
  const collection = collections.find((c) => c.id === asset.collectionId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/assets"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Asset Library
        </Link>
        <Link
          href={`/curation/${asset.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Open Review Workspace
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <AssetThumbnail
              src={version.previewPath}
              alt={`Preview of ${asset.name}`}
              type={asset.type}
              className="aspect-video w-full"
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={asset.status} />
                {asset.isAiGenerated && (
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    AI Generated
                  </span>
                )}
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
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Review Score</h3>
              <p className="text-xs text-zinc-500">Curator evaluation — not AI confidence</p>
            </CardHeader>
            <CardContent>
              {version.curatorScore !== undefined ? (
                <div>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{version.curatorScore}</p>
                  <p className="text-xs text-zinc-500">Curator Quality Score / 100</p>
                </div>
              ) : (
                <QualityScoreDisplay score={version.qualityScore} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Curator Review</h3>
            </CardHeader>
            <CardContent>
              <ReviewActions
                assetId={asset.id}
                currentDecision={version.reviewDecision.type}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Metadata</h3>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Title</dt>
                <dd className="text-right font-medium">{version.metadata.title}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Format</dt>
                <dd className="font-medium">{version.metadata.format}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">File size</dt>
                <dd className="font-medium">{formatFileSize(version.metadata.fileSize)}</dd>
              </div>
              {version.metadata.dimensions && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">Dimensions</dt>
                  <dd className="font-medium">
                    {version.metadata.dimensions.width} × {version.metadata.dimensions.height}
                  </dd>
                </div>
              )}
              {version.metadata.duration !== undefined && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">Duration</dt>
                  <dd className="font-medium">{version.metadata.duration}s</dd>
                </div>
              )}
              {version.metadata.generator && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">Generator</dt>
                  <dd className="font-medium">{version.metadata.generator}</dd>
                </div>
              )}
              {version.metadata.prompt && (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Prompt</dt>
                  <dd className="mt-1 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                    {version.metadata.prompt}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Created</dt>
                <dd className="font-medium">{formatDate(version.metadata.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Organization</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {collection && (
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Collection</p>
                <Badge color={collection.color} className="mt-1">
                  {collection.name}
                </Badge>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Tags</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {asset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Status</p>
              <p className="mt-1 text-sm font-medium">{statusLabel(asset.status)}</p>
            </div>
            {version.reviewDecision.notes && (
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Review notes</p>
                <p className="mt-1 text-sm">{version.reviewDecision.notes}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  — {version.reviewDecision.reviewer}, {formatDate(version.reviewDecision.decidedAt)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DecisionHistoryPanel history={asset.decisionHistory} />

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold">Version History</h3>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {asset.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    v{v.versionNumber} — {v.label}
                    {v.isCurrent && (
                      <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">
                        (current)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(v.createdAt)} · Quality {v.qualityScore.overall} ·{" "}
                    {v.reviewDecision.type.replace("_", " ").toLowerCase()}
                  </p>
                </div>
                <StatusBadge
                  status={
                    v.reviewDecision.type === "PENDING"
                      ? "IN_REVIEW"
                      : v.reviewDecision.type === "APPROVED"
                        ? "APPROVED"
                        : v.reviewDecision.type === "REJECTED"
                          ? "REJECTED"
                          : "CHANGES_REQUESTED"
                  }
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
