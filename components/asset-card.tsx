"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import type { Asset, AssetSearchHit, Collection } from "@/types";
import { useAssets } from "@/lib/assets-context";
import { useDrawer } from "@/lib/drawer-context";
import { assetTypeLabel, getCurrentVersion } from "@/lib/utils";
import { resolvePublicAssetPath } from "@/lib/base-path";
import { AssetThumbnail } from "./asset-thumbnail";
import { SearchMatchBadge } from "./search-match-badge";
import { StatusBadge } from "./status-badge";
import { AssetTypeIcon } from "./asset-type-icon";

interface AssetCardProps {
  asset: Asset;
  collection?: Collection;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  hit?: AssetSearchHit;
}

const FALLBACK_ASPECT_RATIO: Record<Asset["type"], number> = {
  image: 4 / 3,
  video: 16 / 9,
  audio: 16 / 9,
  "3d": 3 / 4,
  other: 4 / 3,
};

const frameSpring = { type: "spring", stiffness: 320, damping: 24 } as const;

const glintVariants: Variants = {
  idle: { x: "-360%" },
  hover: { x: "360%", transition: { type: "spring", stiffness: 90, damping: 16, mass: 0.5 } },
};

function naturalAspectRatio(asset: Asset): number {
  const dims = getCurrentVersion(asset).metadata.dimensions;
  if (dims && dims.width > 0 && dims.height > 0) return dims.width / dims.height;
  return FALLBACK_ASPECT_RATIO[asset.type];
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

export function AssetCard({
  asset,
  collection,
  bulkMode = false,
  selected = false,
  onToggleSelect,
  hit,
}: AssetCardProps) {
  const { getAssetHealth } = useAssets();
  const { openDrawer } = useDrawer();
  const [hovered, setHovered] = useState(false);

  const version = getCurrentVersion(asset);
  const health = getAssetHealth(asset.id);
  const qualityScore = version.curatorScore ?? version.qualityScore.overall;
  const aspectRatio = naturalAspectRatio(asset);
  const mediaSrc = version.mediaUrl ?? version.previewPath;
  const downloadHref = mediaSrc ? resolvePublicAssetPath(mediaSrc) : undefined;
  const showPreview = hovered && asset.type === "video" && !!mediaSrc;

  const frameVariants = {
    idle: {
      y: 0,
      boxShadow: "0px 0px 0px 0px rgba(0,0,0,0)",
      borderColor: selected ? "rgba(0, 245, 160, 0.55)" : "rgba(40, 51, 62, 1)",
    },
    hover: selected
      ? {
          y: -4,
          boxShadow: "0px 0px 0px 0px rgba(0,0,0,0)",
          borderColor: "rgba(0, 245, 160, 0.55)",
        }
      : {
          y: -6,
          boxShadow:
            "0px 18px 44px -20px rgba(0,0,0,0.7), 0px 0px 0px 1px rgba(0,245,160,0.32)",
          borderColor: "rgba(0, 245, 160, 0.4)",
        },
  };

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden rounded-md border bg-surface"
      variants={frameVariants}
      initial="idle"
      whileHover="hover"
      transition={
        selected
          ? { y: frameSpring }
          : {
              y: frameSpring,
              boxShadow: { type: "spring", stiffness: 300, damping: 28 },
              borderColor: { type: "spring", stiffness: 300, damping: 28 },
            }
      }
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px overflow-hidden"
      >
        <motion.span
          className="block h-px w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent"
          variants={glintVariants}
        />
      </motion.span>

      {bulkMode && (
        <label className="absolute left-2.5 top-2.5 z-30 flex items-center gap-1.5 rounded-sm border border-border bg-surface/95 px-2 py-1 text-[11px] font-medium text-foreground">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${asset.name}`}
            className="rounded-sm border-border accent-accent"
          />
          Select
        </label>
      )}

      <div className="flex flex-1 flex-col">
        <button
          type="button"
          onClick={() => openDrawer(asset.id)}
          aria-label={`Quick view ${asset.name}`}
          className="block w-full cursor-pointer text-left"
        >
          <div
            className="visual-hover relative w-full border-b border-border"
            style={{ aspectRatio: String(aspectRatio) }}
          >
            {showPreview ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.24 }}
                  className="absolute inset-0"
                >
                  <video
                    src={resolvePublicAssetPath(mediaSrc as string)}
                    poster={resolvePublicAssetPath(version.thumbnailPath)}
                    muted
                    playsInline
                    autoPlay
                    loop
                    preload="metadata"
                    className="h-full w-full object-cover"
                    aria-label={`Preview of ${asset.name}`}
                  />
                </motion.div>
                <div className="absolute bottom-2 right-2 z-10 rounded-md bg-black/50 p-1.5 text-white backdrop-blur-sm">
                  <AssetTypeIcon type="video" />
                </div>
              </>
            ) : (
              <AssetThumbnail
                src={version.thumbnailPath}
                alt={`Thumbnail for ${asset.name}`}
                type={asset.type}
                className="h-full w-full"
              />
            )}
          </div>
        </button>

        <Link href={`/assets/${asset.id}`} className="flex flex-1 flex-col" aria-label={`Open full page for ${asset.name}`}>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-accent">
                  {asset.name}
                </h3>
                {hit && <SearchMatchBadge hit={hit} />}
              </div>
              <StatusBadge status={asset.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="text-muted">{assetTypeLabel(asset.type)}</span>
              <span className="text-border" aria-hidden="true">·</span>
              <span className="font-medium text-foreground">Q{qualityScore}</span>
              {collection && (
                <>
                  <span className="text-border" aria-hidden="true">·</span>
                  <span className="text-muted">{collection.name}</span>
                </>
              )}
            </div>

            {asset.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                {asset.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="tag-muted">{tag}</span>
                ))}
              </div>
            )}

            {health && health.completeCount < health.totalCount && (
              <p className="text-[11px] text-muted">
                {health.completeCount}/{health.totalCount} health criteria met
              </p>
            )}
          </div>
        </Link>
      </div>

      <AnimatePresence>
        {hovered && (
          <motion.div
            key="glass-overlay"
            className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between bg-black/45 p-3 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="rounded-sm bg-white/10 px-2 py-1 font-mono text-[11px] font-semibold text-accent backdrop-blur-sm">
                Q{qualityScore}
              </span>
              <StatusBadge status={asset.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setHovered(false);
                  openDrawer(asset.id);
                }}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
                aria-label={`Quick view ${asset.name}`}
              >
                <EyeIcon />
                Quick View
              </button>
              {downloadHref && (
                <a
                  href={downloadHref}
                  download={asset.name}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm bg-accent/90 px-3 py-1.5 text-xs font-semibold text-accent-foreground backdrop-blur-md transition-colors hover:bg-accent"
                  aria-label={`Download ${asset.name}`}
                >
                  <DownloadIcon />
                  Download
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}