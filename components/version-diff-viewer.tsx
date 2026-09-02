"use client";

import { useMemo, useState } from "react";
import type { Asset, AssetVersion } from "@/types";
import {
  buildVersionDiffSide,
  computeVersionDiff,
  type VersionDiffField,
} from "@/lib/version-diff";
import { formatFileSize } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Select } from "./ui/select";

interface VersionDiffViewerProps {
  asset: Asset;
}

export function VersionDiffViewer({ asset }: VersionDiffViewerProps) {
  const versions = useMemo(
    () => [...asset.versions].sort((a, b) => a.versionNumber - b.versionNumber),
    [asset.versions],
  );

  const [baseId, setBaseId] = useState(versions[0]?.id ?? "");
  const [targetId, setTargetId] = useState(
    versions.find((v) => v.id === asset.currentVersionId)?.id ?? versions[versions.length - 1]?.id ?? "",
  );

  const baseVersion = versions.find((v) => v.id === baseId) ?? versions[0];
  const targetVersion = versions.find((v) => v.id === targetId) ?? versions[versions.length - 1];

  const diff = useMemo(() => {
    if (!baseVersion || !targetVersion) return null;
    return computeVersionDiff(
      buildVersionDiffSide(baseVersion, asset),
      buildVersionDiffSide(targetVersion, asset),
    );
  }, [baseVersion, targetVersion, asset]);

  if (versions.length < 2) {
    return (
      <Card>
        <CardHeader>
          <h3 className="section-label">Version Diff</h3>
          <p className="text-xs text-muted">
            Compare two versions side by side and see exactly what changed.
          </p>
        </CardHeader>
        <CardContent>
          <Badge color="#fbbf24">Single version — upload a new version to compare</Badge>
        </CardContent>
      </Card>
    );
  }

  if (!diff || !baseVersion || !targetVersion) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="section-label">Version Diff</h3>
        <p className="text-xs text-muted">
          Side-by-side comparison of the selected versions. Prompts and EXIF are diffed from the
          version records and the asset&apos;s current extracted metadata.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={baseVersion.id} onChange={(e) => setBaseId(e.target.value)} aria-label="Base version">
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber} — {v.label}
              </option>
            ))}
          </Select>
          <span aria-hidden="true" className="text-border">
            vs
          </span>
          <Select value={targetVersion.id} onChange={(e) => setTargetId(e.target.value)} aria-label="Target version">
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber} — {v.label}
              </option>
            ))}
          </Select>
          {diff.identical ? (
            <Badge color="#34d399">No differences</Badge>
          ) : (
            <Badge color="#fbbf24">
              {diff.totalChanges} change{diff.totalChanges === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <VersionPreview version={baseVersion} />
          <VersionPreview version={targetVersion} />
        </div>

        {diff.identical ? (
          <p className="text-sm text-muted">
            These versions are identical across media, metadata, AI tags, and quality scores.
          </p>
        ) : (
          <div className="space-y-5">
            <DiffGroup title="Media" fields={diff.media} />
            <DiffGroup title="Metadata" fields={diff.metadata} />
            <AITagDiff added={diff.aiTags.added} removed={diff.aiTags.removed} />
            <DiffGroup title="Quality" fields={diff.quality} />
            <DiffGroup title="Production readiness" fields={diff.readiness} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VersionPreview({ version }: { version: AssetVersion }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-surface-elevated px-3 py-2">
        <p className="text-sm font-medium">
          v{version.versionNumber} — {version.label}
        </p>
        {version.isCurrent && (
          <span className="rounded-sm bg-accent-muted px-1.5 py-0.5 text-xs text-accent">
            Current
          </span>
        )}
      </div>
      <div className="flex aspect-video items-center justify-center bg-background">
        {failed || !version.previewPath ? (
          <div className="px-4 text-center text-sm text-muted">Preview unavailable</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={version.previewPath}
            alt={`v${version.versionNumber} — ${version.label} preview`}
            className="h-full max-h-[22rem] w-full object-contain"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-surface px-3 py-2 text-xs text-muted">
        <span>{version.metadata.format}</span>
        <span>{formatFileSize(version.metadata.fileSize)}</span>
      </div>
    </div>
  );
}

function DiffGroup({ title, fields }: { title: string; fields: VersionDiffField[] }) {
  if (fields.length === 0) return null;
  return (
    <div>
      <h4 className="section-label">{title}</h4>
      <ul className="mt-2 divide-y divide-border-subtle rounded-md border border-border bg-surface-elevated">
        {fields.map((field) => (
          <DiffRow key={field.id} field={field} />
        ))}
      </ul>
    </div>
  );
}

function DiffRow({ field }: { field: VersionDiffField }) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span className="flex-1 text-muted">{field.label}</span>
      {field.before !== null && (
        <span className="max-w-[12rem] truncate text-muted line-through decoration-border">
          {field.before}
        </span>
      )}
      <span aria-hidden="true" className="text-border">
        →
      </span>
      <span className="max-w-[12rem] truncate font-medium text-foreground">
        {field.after ?? "—"}
      </span>
      {field.delta !== undefined && field.direction && (
        <Badge color={field.direction === "increased" ? "#34d399" : "#f87171"}>
          {formatDelta(field)}
        </Badge>
      )}
    </li>
  );
}

function AITagDiff({ added, removed }: { added: string[]; removed: string[] }) {
  if (added.length === 0 && removed.length === 0) return null;
  return (
    <div>
      <h4 className="section-label">AI Tags</h4>
      <div className="mt-2 space-y-2 rounded-md border border-border bg-surface-elevated px-3 py-2">
        {added.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Added</span>
            {added.map((tag) => (
              <Badge key={tag} color="#34d399">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {removed.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Removed</span>
            {removed.map((tag) => (
              <Badge key={tag} color="#f87171">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDelta(field: VersionDiffField): string {
  const delta = field.delta ?? 0;
  const sign = delta > 0 ? "+" : "−";
  const magnitude = Math.abs(delta);
  const value = magnitude >= 1024 ? formatFileSize(magnitude) : `${magnitude}`;
  return `${sign}${value}`;
}