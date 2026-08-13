"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { validateUploadFile } from "@/lib/upload-validation";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Select } from "./ui/select";

type UploadStatus = "idle" | "processing" | "ready" | "error";

export function AssetUpload() {
  const { uploadAsset, collections } = useAssets();
  const inputRef = useRef<HTMLInputElement>(null);
  const [collectionId, setCollectionId] = useState("col-archive-draft");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastUploadedId, setLastUploadedId] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setSuccessMessage(null);
    setLastUploadedId(null);
    setStatus("processing");

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

      const result = await uploadAsset(file, collectionId);
      if (result.ok) {
        uploaded++;
        lastId = result.assetId ?? null;
      } else {
        setError(result.error ?? "Could not process this file. Try a different format.");
        setStatus("error");
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }

    if (uploaded > 0) {
      setSuccessMessage(
        `${uploaded} asset${uploaded > 1 ? "s" : ""} added for this session. Files are processed locally only.`,
      );
      setLastUploadedId(lastId);
      setStatus("ready");
    } else {
      setStatus("idle");
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  const isProcessing = status === "processing";

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Upload Assets</h3>
        <p className="text-xs text-muted">
          Files are processed locally and stored only for this session. Refreshing the page may
          remove uploaded assets.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs"
          role="status"
          aria-live="polite"
        >
          Status:{" "}
          <span className="font-medium text-foreground">
            {status === "idle" && "Ready to upload"}
            {status === "processing" && "Processing file and extracting metadata…"}
            {status === "ready" && "Upload complete"}
            {status === "error" && "Upload failed"}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="asset-upload-input" className="mb-1 block text-xs font-medium text-muted">
              Select files (image, video, audio, 3D, or other)
            </label>
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
          </div>
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={isProcessing}
            onClick={() => inputRef.current?.click()}
          >
            {isProcessing ? "Processing…" : "Choose files"}
          </Button>
          <p className="text-xs text-muted">
            Category detected from file type and extension.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {successMessage && (
          <div className="space-y-2" role="status">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p>
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

        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Nothing is sent to a server. Very large files may be slow to preview depending on your
          browser.
        </p>
      </CardContent>
    </Card>
  );
}
