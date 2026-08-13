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
    <div className="space-y-8">
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
        <p className="rounded-md border border-status-warning/30 bg-status-warning-muted px-4 py-2 text-sm text-status-warning">
          Session-only upload — this asset exists only in your current browser session. Refreshing
          the page may remove it.
        </p>
      )}

      <section>
        <div className="hero-preview visual-hover rounded-md border border-border">
          <AssetMediaPreview
            asset={asset}
            className="aspect-video w-full lg:min-h-[20rem]"
            priority
          />
        </div>
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={asset.status} />
            {asset.isAiGenerated && <SourceBadge source="ai" />}
            <span className="text-muted">{assetTypeLabel(asset.type)}</span>
            {collection && (
              <>
                <span className="text-border" aria-hidden="true">
                  ·
                </span>
                <Badge color={collection.color}>{collection.name}</Badge>
              </>
            )}
            <span className="text-border" aria-hidden="true">
              ·
            </span>
            <span className="text-muted">v{version.versionNumber}</span>
          </div>
          <h1 className="display-title mt-3">{asset.name}</h1>
          <p className="editorial-lead mt-3">{version.metadata.description}</p>
        </div>
      </section>

      <section className="editorial-section grid gap-8 lg:grid-cols-3">
        <AssetHealthPanel assetId={asset.id} />

        <div>
          <p className="section-label">Review Score</p>
          <p className="mt-1 text-xs text-muted">Curator evaluation — not AI confidence</p>
          <div className="mt-4">
            {version.curatorScore !== undefined ? (
              <div>
                <p className="text-4xl font-semibold tracking-tight text-foreground">
                  {version.curatorScore}
                </p>
                <p className="mt-1 text-xs text-muted">Curator Quality Score / 100</p>
              </div>
            ) : (
              <QualityScoreDisplay score={version.qualityScore} />
            )}
          </div>
        </div>

        <div>
          <p className="section-label">Curator Review</p>
          <div className="mt-4">
            <ReviewActions
              assetId={asset.id}
              currentDecision={version.reviewDecision.type}
            />
          </div>
        </div>
      </section>

      <section className="editorial-section grid gap-8 lg:grid-cols-2">
        <ExtractedMetadataPanel asset={asset} />

        <div>
          <h3 className="section-title">Asset Metadata</h3>
          <dl className="mt-4 space-y-3 text-sm">
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
        </div>
      </section>

      <MetadataEditor asset={asset} collections={collections} />

      <section className="editorial-section grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="section-title">Organization</h3>
          <div className="mt-4 space-y-4">
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
                  <span key={tag} className="tag-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Status</p>
              <p className="mt-1 text-sm font-medium">{statusLabel(asset.status)}</p>
            </div>
          </div>
        </div>

        <RelatedAssetsPanel assetId={asset.id} />
      </section>

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
