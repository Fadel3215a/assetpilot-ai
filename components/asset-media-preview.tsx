"use client";

import type { Asset, AssetType } from "@/types";
import { getCurrentVersion } from "@/lib/utils";
import { AssetTypeIcon, assetTypeIconLabel } from "./asset-type-icon";

interface AssetMediaPreviewProps {
  asset: Asset;
  className?: string;
  priority?: boolean;
}

export function AssetMediaPreview({
  asset,
  className = "aspect-video w-full",
  priority = false,
}: AssetMediaPreviewProps) {
  const version = getCurrentVersion(asset);
  const src = version.mediaUrl ?? version.previewPath;
  const alt = `Preview of ${asset.name}`;

  return (
    <div className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${className}`}>
      <MediaByType type={asset.type} src={src} alt={alt} priority={priority} />
      <div className="absolute bottom-2 right-2 rounded-md bg-black/50 p-1.5 text-white backdrop-blur-sm">
        <AssetTypeIcon type={asset.type} />
      </div>
    </div>
  );
}

function MediaByType({
  type,
  src,
  alt,
  priority,
}: {
  type: AssetType;
  src: string;
  alt: string;
  priority?: boolean;
}) {
  const isBlob = src.startsWith("blob:");

  if (type === "video") {
    return (
      <video
        src={src}
        controls
        className="h-full w-full object-contain"
        aria-label={alt}
      >
        <track kind="captions" />
      </video>
    );
  }

  if (type === "audio") {
    return (
      <div className="flex h-full min-h-32 flex-col items-center justify-center gap-4 p-6">
        <AssetTypeIcon type="audio" />
        <audio src={src} controls className="w-full max-w-md" aria-label={alt}>
          <track kind="captions" />
        </audio>
      </div>
    );
  }

  if (type === "3d") {
    return (
      <div
        className="flex h-full min-h-48 flex-col items-center justify-center gap-3 p-8 text-center"
        role="img"
        aria-label={assetTypeIconLabel("3d")}
      >
        <div className="rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-6 dark:border-indigo-700 dark:bg-indigo-950/40">
          <AssetTypeIcon type="3d" />
        </div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">3D Asset</p>
        <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
          3D preview placeholder — full rendering not available in this prototype.
        </p>
      </div>
    );
  }

  if (type === "other") {
    return (
      <div
        className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-6 text-center"
        role="img"
        aria-label="Generic file preview"
      >
        <AssetTypeIcon type="other" />
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">File Asset</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Generic preview — no visual renderer.</p>
      </div>
    );
  }

  if (isBlob || src.startsWith("/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-contain"
      loading={priority ? "eager" : "lazy"}
    />
  );
}
