"use client";

import type { Asset, ExtractedFileMetadata } from "@/types";
import { assetTypeLabel, formatFileSize } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./ui/card";

interface ExtractedMetadataPanelProps {
  asset: Asset;
}

export function ExtractedMetadataPanel({ asset }: ExtractedMetadataPanelProps) {
  const extracted: ExtractedFileMetadata | undefined = asset.extractedMetadata;

  if (!extracted && !asset.isSessionUpload) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
          Extracted Metadata
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Read from file properties — not AI-generated.
        </p>
      </CardHeader>
      <CardContent>
        {extracted ? (
          <dl className="space-y-3 text-sm">
            <MetadataRow label="File name" value={extracted.fileName} />
            <MetadataRow label="Type" value={assetTypeLabel(asset.type)} />
            <MetadataRow label="Extension" value={extracted.extension || "—"} />
            <MetadataRow label="MIME type" value={extracted.mimeType} />
            <MetadataRow label="Size" value={formatFileSize(extracted.fileSize)} />
            {extracted.dimensions && (
              <MetadataRow
                label="Dimensions"
                value={`${extracted.dimensions.width} × ${extracted.dimensions.height}`}
              />
            )}
            {extracted.duration !== undefined && (
              <MetadataRow label="Duration" value={`${extracted.duration}s`} />
            )}
            {extracted.lastModified && (
              <MetadataRow
                label="Last modified"
                value={new Date(extracted.lastModified).toLocaleString()}
              />
            )}
          </dl>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No extracted file metadata for this seeded demo asset.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
