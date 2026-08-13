import type { ReactNode } from "react";
import type { AssetType } from "@/types";

const icons: Record<AssetType, ReactNode> = {
  image: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  video: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="5" width="15" height="14" rx="2" />
      <path d="M17 9l5-3v12l-5-3" />
    </svg>
  ),
  audio: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 18V6l10-2v14" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  ),
  "3d": (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  other: (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
};

export function AssetTypeIcon({ type }: { type: AssetType }) {
  return (
    <span className="text-muted" aria-hidden="true">
      {icons[type]}
    </span>
  );
}

export function assetTypeIconLabel(type: AssetType): string {
  const labels: Record<AssetType, string> = {
    image: "Image asset",
    video: "Video asset",
    audio: "Audio asset",
    "3d": "3D asset",
    other: "Other file asset",
  };
  return labels[type];
}
