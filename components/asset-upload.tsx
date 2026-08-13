"use client";

import { useRef, useState } from "react";
import { useAssets } from "@/lib/assets-context";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Select } from "./ui/select";

export function AssetUpload() {
  const { uploadAsset, collections } = useAssets();
  const inputRef = useRef<HTMLInputElement>(null);
  const [collectionId, setCollectionId] = useState("col-archive-draft");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setSuccess(null);
    setUploading(true);

    let uploaded = 0;
    for (const file of Array.from(files)) {
      const result = await uploadAsset(file, collectionId);
      if (result.ok) uploaded++;
      else setError(result.error ?? "Upload failed.");
    }

    if (uploaded > 0) {
      setSuccess(
        `${uploaded} asset${uploaded > 1 ? "s" : ""} added to the library for this session.`,
      );
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Upload Assets</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Session-only upload — files stay in your browser. Refreshing the page may remove uploaded
          assets.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="asset-upload-input" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Select files (image, video, audio, 3D, or other)
            </label>
            <input
              ref={inputRef}
              id="asset-upload-input"
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.glb,.gltf,.obj,.fbx,.usdz,*/*"
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
              className="sr-only"
            />
          </div>
          <div className="sm:w-48">
            <label htmlFor="upload-collection" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Default collection
            </label>
            <Select
              id="upload-collection"
              value={collectionId}
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

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Processing…" : "Choose files"}
          </Button>
          <p className="self-center text-xs text-zinc-500 dark:text-zinc-400">
            Supported categories detected from file type and extension.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
            {success}
          </p>
        )}

        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Files are not sent to a server. Object URLs are used for previews during this session only.
        </p>
      </CardContent>
    </Card>
  );
}
