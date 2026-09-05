"use client";

import { useState } from "react";
import { Button } from "./ui/button";

interface ExportZipButtonProps {
  /** Specific assets to include in the ZIP. */
  assetIds?: string[];
  /** All assets in a collection. */
  collectionId?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * Stage 2.3 — Streaming ZIP export trigger.
 *
 * POSTs to /api/export/stream and hands the resulting ZIP to the browser as a
 * download. The server streams the archive without buffering files in memory;
 * the browser buffers the received ZIP only while assembling the download.
 */
export function ExportZipButton({
  assetIds = [],
  collectionId,
  label = "Export ZIP",
  disabled = false,
}: ExportZipButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setError(null);
    setExporting(true);
    try {
      const response = await fetch("/api/export/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(assetIds.length > 0 ? { assetIds: [...new Set(assetIds)] } : {}),
          ...(collectionId ? { collectionId } : {}),
        }),
      });

      if (!response.ok) {
        let message = "Export failed. Please try again.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {
          // Non-JSON error body — keep the default message.
        }
        setError(message);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "assetpilot-export.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        onClick={handleExport}
        disabled={disabled || exporting}
      >
        {exporting ? "Preparing…" : label}
      </Button>
      {error && (
        <p className="text-xs text-status-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}