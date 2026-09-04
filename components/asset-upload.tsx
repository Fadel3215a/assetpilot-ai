"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { validateUploadFile } from "@/lib/upload-validation";
import type { DirectUploadByteProgress } from "@/lib/storage/client-upload";
import { JobProgress } from "./job-progress";
import { Button } from "./ui/button";
import { Select } from "./ui/select";

type UploadStatus = "idle" | "processing" | "ready" | "error";

const typeLabels = ["Images", "Video", "Audio", "3D", "Other"] as const;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function AssetUpload() {
  const { uploadViaStorage, collections } = useAssets();
  const inputRef = useRef<HTMLInputElement>(null);
  const [collectionId, setCollectionId] = useState("col-archive-draft");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastUploadedId, setLastUploadedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [byteProgress, setByteProgress] = useState<DirectUploadByteProgress | null>(null);
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setSuccessMessage(null);
    setLastUploadedId(null);
    setStatus("processing");
    setByteProgress(null);
    setTrackingJobId(null);

    let uploaded = 0;
    let lastId: string | null = null;

    for (const file of Array.from(files)) {
      const validation = validateUploadFile(file);
      if (!validation.ok) {
        setError(validation.message);
        setStatus("error");
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      setByteProgress(null);
      const result = await uploadViaStorage(file, collectionId, {
        onByteProgress: (progress) => setByteProgress(progress),
      });
      if (result.ok) {
        uploaded++;
        lastId = result.assetId ?? null;
        if (result.assetId) setTrackingJobId(result.assetId);
      } else {
        setError(result.error ?? "Could not process this file. Try a different format.");
        setStatus("error");
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }

    setByteProgress(null);
    setTrackingJobId(null);

    if (uploaded > 0) {
      setSuccessMessage(
        `${uploaded} asset${uploaded > 1 ? "s" : ""} added for this session. Files are uploaded directly to storage.`,
      );
      setLastUploadedId(lastId);
      setStatus("ready");
    } else {
      setStatus("idle");
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  const isProcessing = status === "processing";

  function openFilePicker() {
    if (!isProcessing) {
      inputRef.current?.click();
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h3 className="section-title">Upload Assets</h3>
        <p className="mt-1 text-xs text-muted">
          Files are processed locally and stored only for this session. Refreshing the page may
          remove uploaded assets.
        </p>
      </div>

      <div
        className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
        role="status"
        aria-live="polite"
      >
        Status:{" "}
        <span className="font-medium text-foreground">
          {status === "idle" && "Ready to upload"}
          {status === "processing" && "Processing file…"}
          {status === "ready" && "Upload complete"}
          {status === "error" && "Upload failed"}
        </span>
      </div>

      {isProcessing && byteProgress && byteProgress.totalBytes > 0 && (
        <div className="space-y-1" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-foreground">Uploading to storage</span>
            <span className="text-muted">
              {formatBytes(byteProgress.uploadedBytes)} / {formatBytes(byteProgress.totalBytes)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted/40">
            <div
              className="h-full bg-foreground/70 transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.round((byteProgress.uploadedBytes / byteProgress.totalBytes) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {isProcessing && trackingJobId && (
        <JobProgress key={trackingJobId} jobId={trackingJobId} />
      )}

      <input
        ref={inputRef}
        id="asset-upload-input"
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.glb,.gltf,.obj,.fbx,.usdz,*/*"
        disabled={isProcessing}
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
      />

      <div
        className={`upload-dropzone ${dragging ? "upload-dropzone-dragover" : ""} ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
        role="button"
        tabIndex={isProcessing ? -1 : 0}
        aria-label="Upload files by clicking or dropping"
        aria-busy={isProcessing}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFilePicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap justify-center gap-2">
          {typeLabels.map((label) => (
            <span key={label} className="tag-muted">
              {label}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">
          {isProcessing
            ? "Processing…"
            : dragging
              ? "Release to upload"
              : "Drop files here or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Category detected from file type and extension.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <label htmlFor="upload-collection" className="mb-1 block text-xs font-medium text-muted">
            Default collection
          </label>
          <Select
            id="upload-collection"
            value={collectionId}
            disabled={isProcessing}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" disabled={isProcessing} onClick={openFilePicker}>
          {isProcessing ? "Processing…" : "Choose files"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-status-danger" role="alert">
          {error}
        </p>
      )}
      {successMessage && (
        <div className="space-y-2" role="status">
          <p className="text-sm text-status-success">{successMessage}</p>
          {lastUploadedId && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/assets/${lastUploadedId}`}>
                <Button type="button" variant="secondary" className="text-xs">
                  View asset & metadata
                </Button>
              </Link>
              <Link href={`/curation/${lastUploadedId}`}>
                <Button type="button" className="text-xs">
                  Open review workspace
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      <p className="rounded-md border border-status-info/30 bg-surface px-3 py-2 text-xs text-muted">
        Files upload directly to storage (S3/R2 when configured, otherwise local). AI analysis
        runs through the background queue — with a Gemini key the review is generated live;
        without one a deterministic local analysis is used.
      </p>
    </section>
  );
}
