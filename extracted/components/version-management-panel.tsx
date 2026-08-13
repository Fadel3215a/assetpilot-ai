"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Asset } from "@/types";
import { useAssets } from "@/lib/assets-context";
import { findComparisonPartner, formatDate, formatFileSize } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Input } from "./ui/input";

interface VersionManagementPanelProps {
  asset: Asset;
}

export function VersionManagementPanel({ asset }: VersionManagementPanelProps) {
  const { createAssetVersion, assets } = useAssets();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const comparePartner = findComparisonPartner(assets, asset.id);
  const compareHref =
    comparePartner && comparePartner !== asset.id
      ? `/compare?a=${asset.id}&b=${comparePartner}`
      : null;

  const handleCreate = async (withFile: boolean) => {
    if (!label.trim()) {
      setError("Version label is required.");
      return;
    }
    setCreating(true);
    setError(null);
    setMessage(null);

    const file = withFile && fileRef.current?.files?.[0] ? fileRef.current.files[0] : null;
    const result = await createAssetVersion(asset.id, file, label.trim());

    if (result.ok) {
      setMessage(`Version created: ${label.trim()}`);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
    } else {
      setError(result.error ?? "Could not create version.");
    }
    setCreating(false);
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Version Management</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Create new versions without deleting previous ones. The latest version is marked current.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {asset.versions.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No versions recorded.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[...asset.versions]
              .sort((a, b) => b.versionNumber - a.versionNumber)
              .map((v) => (
                <li key={v.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        v{v.versionNumber} — {v.label}
                        {v.isCurrent && (
                          <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(v.createdAt)} · {formatFileSize(v.metadata.fileSize)} ·{" "}
                        {v.metadata.format}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}

        {compareHref && (
          <Link
            href={compareHref}
            className="inline-flex text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Compare versions with related asset
          </Link>
        )}

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Create new version
          </h4>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="version-label" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Version label
              </label>
              <Input
                id="version-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Color correction pass"
              />
            </div>
            <div>
              <label htmlFor="version-file" className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Optional replacement file (session-only)
              </label>
              <input
                ref={fileRef}
                id="version-file"
                type="file"
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:text-zinc-400 dark:file:bg-zinc-800"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
                {message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={creating} onClick={() => handleCreate(false)}>
                {creating ? "Creating…" : "Create version (metadata only)"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={creating}
                onClick={() => handleCreate(true)}
              >
                Create with file
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
