"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Asset } from "@/types";
import { useDrawer } from "@/lib/drawer-context";
import { useAssets } from "@/lib/assets-context";
import {
  assetTypeLabel,
  formatDate,
  formatFileSize,
  getCurrentVersion,
  statusLabel,
} from "@/lib/utils";
import { resolvePublicAssetPath } from "@/lib/base-path";
import { AssetMediaPreview } from "./asset-media-preview";
import { VectorInspector } from "./vector-inspector";
import { RenditionManager } from "./rendition-manager";
import { QualityScoreDisplay } from "./quality-score-display";
import { ReviewActions } from "./review-actions";
import { StatusBadge } from "./status-badge";
import { SourceBadge } from "./ui/source-badge";
import { Badge } from "./ui/badge";

type DrawerTab = "visuals" | "vector" | "ai";

const TABS: { id: DrawerTab; label: string }[] = [
  { id: "visuals", label: "Visuals & Renditions" },
  { id: "vector", label: "Vector Health" },
  { id: "ai", label: "AI & Curation" },
];

/**
 * Stage 2.1 — Slide-over asset detail drawer.
 *
 * Right-hand panel (max-w-2xl) mounted at the shell root. Animated in/out with
 * framer-motion (x: 100% → 0), a dark translucent backdrop, three tabs, and
 * Esc / ← / → / J / K keyboard navigation driven by the DrawerContext.
 */
export function AssetDetailDrawer() {
  const { isOpen, currentAssetId, closeDrawer, nextAsset, prevAsset } = useDrawer();
  const { getAsset, assets } = useAssets();

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "j" || event.key === "J") {
        event.preventDefault();
        nextAsset();
      } else if (event.key === "ArrowLeft" || event.key === "k" || event.key === "K") {
        event.preventDefault();
        prevAsset();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeDrawer, nextAsset, prevAsset]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const asset = currentAssetId ? getAsset(currentAssetId) : null;
  const currentIndex = asset ? assets.findIndex((a) => a.id === asset.id) : -1;

  return (
    <AnimatePresence>
      {isOpen && asset && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={closeDrawer}
            aria-hidden="true"
          />

          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Asset details for ${asset.name}`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col overflow-hidden border-l border-border bg-background shadow-[0_0_80px_-20px_rgba(0,0,0,0.7)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <StatusBadge status={asset.status} />
                  <SourceBadge source="ai" />
                  <span className="text-muted">{assetTypeLabel(asset.type)}</span>
                  {currentIndex >= 0 && (
                    <span className="text-muted">
                      · {currentIndex + 1}/{assets.length}
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 truncate text-lg font-semibold tracking-tight text-foreground">
                  {asset.name}
                </h2>
                {asset.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {asset.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="tag-muted">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={prevAsset}
                  aria-label="Previous asset"
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={nextAsset}
                  aria-label="Next asset"
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close drawer"
                  className="ml-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-muted transition-colors hover:border-status-danger/40 hover:text-status-danger"
                >
                  ✕
                </button>
              </div>
            </div>

            <DrawerTabs key={asset.id} asset={asset} />

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-2.5 text-[11px] text-muted">
              <span>
                <Kbd>Esc</Kbd> close
              </span>
              <span>
                <Kbd>→</Kbd>/<Kbd>J</Kbd> next · <Kbd>←</Kbd>/<Kbd>K</Kbd> prev
              </span>
              <Link
                href={`/assets/${asset.id}`}
                onClick={closeDrawer}
                className="font-medium text-accent hover:underline"
              >
                Open full page →
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerTabs({ asset }: { asset: Asset }) {
  const [tab, setTab] = useState<DrawerTab>("visuals");

  return (
    <>
      <div
        className="flex shrink-0 gap-1 border-b border-border px-3 pt-2"
        role="tablist"
        aria-label="Asset detail sections"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative rounded-t-md px-3 py-2 text-xs font-medium transition-colors ${
                active ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="drawer-tab-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <TabPanel active={tab === "visuals"} id="visuals">
          <VisualsTab assetId={asset.id} />
        </TabPanel>
        <TabPanel active={tab === "vector"} id="vector">
          <VectorInspector key={`vector-${asset.id}`} assetId={asset.id} />
        </TabPanel>
        <TabPanel active={tab === "ai"} id="ai">
          <AICurationTab assetId={asset.id} />
        </TabPanel>
      </div>
    </>
  );
}

function TabPanel({
  active,
  id,
  children,
}: {
  active: boolean;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div hidden={!active} role="tabpanel" id={`drawer-panel-${id}`} aria-label={id}>
      {active ? children : null}
    </div>
  );
}

function VisualsTab({ assetId }: { assetId: string }) {
  const { getAsset, collections } = useAssets();
  const asset = getAsset(assetId);
  if (!asset) return null;

  const version = getCurrentVersion(asset);
  const collection = collections.find((c) => c.id === asset.collectionId);
  const mediaUrl = version.mediaUrl ?? version.previewPath;
  const downloadHref = mediaUrl ? resolvePublicAssetPath(mediaUrl) : undefined;

  return (
    <div className="space-y-6">
      <div className="hero-preview visual-hover overflow-hidden rounded-md border border-border">
        <AssetMediaPreview asset={asset} className="aspect-video w-full" priority={false} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {collection && <Badge color={collection.color}>{collection.name}</Badge>}
        <span className="text-muted">v{version.versionNumber}</span>
        <span className="text-muted">·</span>
        <span className="text-muted">{formatFileSize(version.metadata.fileSize)}</span>
        {version.metadata.dimensions && (
          <>
            <span className="text-muted">·</span>
            <span className="text-muted">
              {version.metadata.dimensions.width}×{version.metadata.dimensions.height}
            </span>
          </>
        )}
        {downloadHref && (
          <a
            href={downloadHref}
            download={asset.name}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            Download
          </a>
        )}
      </div>

      <div>
        <p className="section-label">Version timeline</p>
        <ul className="mt-3 space-y-2">
          {[...asset.versions]
            .sort((a, b) => b.versionNumber - a.versionNumber)
            .map((v) => (
              <li
                key={v.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                  v.isCurrent ? "border-accent/30 bg-accent/5" : "border-border bg-surface"
                }`}
              >
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">v{v.versionNumber}</span>
                  {v.label && <span className="text-muted">{v.label}</span>}
                  {v.isCurrent && (
                    <span className="rounded-sm border border-accent/25 bg-accent/5 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                      Current
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <DerivativeTag label="Thumbnail" path={v.thumbnailPath} />
                  <DerivativeTag label="Preview" path={v.previewPath} />
                  <span className="text-[11px] text-muted">{formatDate(v.createdAt)}</span>
                </span>
              </li>
            ))}
        </ul>
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        Derivative status tags reflect the on-disk presence of the thumbnail and preview
        renditions. Use the AI &amp; Curation tab to regenerate missing derivatives.
      </p>
    </div>
  );
}

function DerivativeTag({ label, path }: { label: string; path: string }) {
  const exists = Boolean(path);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${
        exists
          ? "border-status-success/20 bg-status-success-muted text-status-success"
          : "border-status-warning/30 bg-status-warning-muted text-status-warning"
      }`}
    >
      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current opacity-70" />
      {label} {exists ? "On disk" : "Missing"}
    </span>
  );
}

function AICurationTab({ assetId }: { assetId: string }) {
  const { getAsset } = useAssets();
  const asset = getAsset(assetId);
  if (!asset) return null;

  const version = getCurrentVersion(asset);
  const suggestedTags = asset.aiAnalysis.suggestedTags ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-label">Quality score</p>
            <p className="mt-1 text-xs text-muted">
              {statusLabel(asset.status)} · last updated {formatDate(asset.updatedAt)}
            </p>
          </div>
        </div>
        <div className="mt-3">
          {version.curatorScore !== undefined ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl font-semibold tracking-tight text-foreground">
                {version.curatorScore}
              </span>
              <span className="text-xs text-muted">Curator Score / 100</span>
            </div>
          ) : (
            <QualityScoreDisplay score={version.qualityScore} />
          )}
        </div>
      </div>

      {suggestedTags.length > 0 && (
        <div>
          <p className="section-label">AI-extracted tags</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestedTags.map((t) => (
              <span key={t.id} className="tag-muted">{t.tag}</span>
            ))}
          </div>
        </div>
      )}

      <ReviewActions
        assetId={assetId}
        currentDecision={version.reviewDecision.type}
      />

      <div className="border-t border-border pt-4">
        <RenditionManager key={`renditions-${assetId}`} assetId={assetId} />
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border bg-surface px-1 font-mono text-[9px] text-muted">
      {children}
    </kbd>
  );
}