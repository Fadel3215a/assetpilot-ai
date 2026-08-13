"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useAssets } from "@/lib/assets-context";
import {
  assetTypeLabel,
  findComparisonPartner,
  formatDate,
  formatFileSize,
  getCurrentVersion,
  statusLabel,
} from "@/lib/utils";
import { AIInsightPanel } from "./ai-insight-panel";
import { AssetActivityTimeline } from "./asset-activity-timeline";
import { AssetHealthPanel } from "./asset-health-panel";
import { AssetMediaPreview } from "./asset-media-preview";
import { DuplicateDetectionPanel } from "./duplicate-detection-panel";
import { ExtractedMetadataPanel } from "./extracted-metadata-panel";
import { MetadataEditor } from "./metadata-editor";
import { RelatedAssetsPanel } from "./related-assets-panel";
import { VersionManagementPanel } from "./version-management-panel";
import { QualityScoreDisplay } from "./quality-score-display";
import { ReviewActions } from "./review-actions";
import { DecisionHistoryPanel } from "./decision-history-panel";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { SourceBadge } from "./ui/source-badge";
import { Card, CardContent, CardHeader } from "./ui/card";

export function AssetDetailView({ assetId }: { assetId: string }) {
  const { getAsset, collections, assets } = useAssets();
  const asset = getAsset(assetId);

  if (!asset) {
    notFound();
  }

  const version = getCurrentVersion(asset);
  const collection = collections.find((c) => c.id === asset.collectionId);
  const comparePartnerId = findComparisonPartner(assets, asset.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/curation/${asset.id}`}>
          <Button type="button">Review</Button>
        </Link>
        {comparePartnerId && (
          <Link href={`/compare?a=${asset.id}&b=${comparePartnerId}`}>
            <Button type="button" variant="secondary">
              Compare
            </Button>
          </Link>
        )}
        <a href="#metadata-editor">
          <Button type="button" variant="secondary">
            Edit Metadata
          </Button>
        </a>
        <a href="#version-management">
          <Button type="button" variant="ghost">
            Create Version
          </Button>
        </a>
      </div>

      {asset.isSessionUpload && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Session-only upload — this asset exists only in your current browser session. Refreshing
          the page may remove it.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <AssetMediaPreview asset={asset} priority />
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={asset.status} />
                {asset.isAiGenerated && (
                  <SourceBadge source="ai" />
                )}
                <span className="text-sm text-muted">
                  {assetTypeLabel(asset.type)} · v{version.versionNumber}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-foreground">
                {asset.name}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {version.metadata.description}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <AssetHealthPanel assetId={asset.id} />

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Review Score</h3>
              <p className="text-xs text-muted">Curator evaluation — not AI confidence</p>
            </CardHeader>
            <CardContent>
              {version.curatorScore !== undefined ? (
                <div>
                  <p className="text-3xl font-bold text-foreground">{version.curatorScore}</p>
                  <p className="text-xs text-muted">Curator Quality Score / 100</p>
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
        <ExtractedMetadataPanel asset={asset} />

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Asset Metadata</h3>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="meta-label">Title</dt>
                <dd className="text-right font-medium">{version.metadata.title}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="meta-label">Format</dt>
                <dd className="font-medium">{version.metadata.format}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="meta-label">File size</dt>
                <dd className="font-medium">{formatFileSize(version.metadata.fileSize)}</dd>
              </div>
              {version.metadata.dimensions && (
                <div className="flex justify-between gap-4">
                  <dt className="meta-label">Dimensions</dt>
                  <dd className="font-medium">
                    {version.metadata.dimensions.width} × {version.metadata.dimensions.height}
                  </dd>
                </div>
              )}
              {version.metadata.duration !== undefined && (
                <div className="flex justify-between gap-4">
                  <dt className="meta-label">Duration</dt>
                  <dd className="font-medium">{version.metadata.duration}s</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="meta-label">Created</dt>
                <dd className="font-medium">{formatDate(version.metadata.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <MetadataEditor asset={asset} collections={collections} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Organization</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {collection && (
              <div>
                <p className="text-xs text-muted">Collection</p>
                <Badge color={collection.color} className="mt-1">
                  {collection.name}
                </Badge>
              </div>
            )}
            <div>
              <p className="text-xs text-muted">Tags</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {asset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="tag-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Status</p>
              <p className="mt-1 text-sm font-medium">{statusLabel(asset.status)}</p>
            </div>
          </CardContent>
        </Card>

        <RelatedAssetsPanel assetId={asset.id} />
      </div>

      <DuplicateDetectionPanel assetId={asset.id} />

      <AIInsightPanel asset={asset} />

      <div id="version-management">
        <VersionManagementPanel asset={asset} />
      </div>

      <AssetActivityTimeline assetId={asset.id} />

      <DecisionHistoryPanel history={asset.decisionHistory} />
    </div>
  );
}
