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
        <p className="text-xs text-muted">
          Create new versions without deleting previous ones. The latest version is marked current.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {asset.versions.length === 0 ? (
          <p className="text-sm text-muted">No versions recorded.</p>
        ) : (
          <ul className="divide-y divide-border">
            {[...asset.versions]
              .sort((a, b) => b.versionNumber - a.versionNumber)
              .map((v) => (
                <li key={v.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        v{v.versionNumber} — {v.label}
                        {v.isCurrent && (
                          <span className="ml-2 rounded-sm bg-accent-muted px-1.5 py-0.5 text-xs text-accent">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted">
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
            className="link-subtle inline-flex font-medium"
          >
            Compare versions with related asset
          </Link>
        )}

        <div className="rounded-md border border-border bg-surface p-4">
          <h4 className="section-label">
            Create new version
          </h4>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="version-label" className="mb-1 block text-xs font-medium text-muted">
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
              <label htmlFor="version-file" className="mb-1 block text-xs font-medium text-muted">
                Optional replacement file (session-only)
              </label>
              <input
                ref={fileRef}
                id="version-file"
                type="file"
                className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-elevated file:px-3 file:py-1.5 file:text-sm file:text-foreground"
              />
            </div>
            {error && (
              <p className="text-sm text-status-danger" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-status-success" role="status">
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
