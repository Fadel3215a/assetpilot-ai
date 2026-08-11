"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAssets } from "@/lib/assets-context";
import { generateComparisonSummary } from "@/lib/generate-ai-analysis";
import { metadataCompleteness } from "@/lib/quality";
import { comparisonDecisionLabel } from "@/lib/production";
import { assetTypeLabel, findComparisonPartner, getCurrentVersion } from "@/lib/utils";
import { AIComparisonSummaryPanel } from "@/components/ai-comparison-summary";
import { AssetThumbnail } from "@/components/asset-thumbnail";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { ComparisonDecisionType } from "@/types";

function ComparisonPanel({
  assetId,
  versionId,
  label,
}: {
  assetId: string;
  versionId: string;
  label: string;
}) {
  const { getAsset } = useAssets();
  const asset = getAsset(assetId);

  if (!asset) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-zinc-500">
          Asset not found
        </CardContent>
      </Card>
    );
  }

  const version = asset.versions.find((v) => v.id === versionId) ?? getCurrentVersion(asset);
  const metaComplete = metadataCompleteness(version.metadata);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          {label}
        </p>
        <h3 className="text-sm font-semibold">{asset.name}</h3>
      </CardHeader>
      <AssetThumbnail
        src={version.previewPath}
        alt={asset.name}
        type={asset.type}
        className="aspect-video w-full"
      />
      <CardContent className="space-y-2 text-sm">
        <p className="text-zinc-500">{assetTypeLabel(asset.type)} · v{version.versionNumber}</p>
        <div className="flex items-center gap-2">
          <StatusBadge status={asset.status} />
          <span className="text-zinc-500">Score: {version.curatorScore ?? version.qualityScore.overall}</span>
        </div>
        <p className="text-zinc-500">Metadata: {metaComplete}% complete</p>
        <div className="flex flex-wrap gap-1">
          {asset.tags.map((t) => (
            <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{t}</span>
          ))}
        </div>
        <Link href={`/curation/${asset.id}`} className="inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400">
          Open review workspace
        </Link>
      </CardContent>
    </Card>
  );
}

export function ComparisonPage() {
  const { assets, collections, submitComparison, comparisons } = useAssets();
  const searchParams = useSearchParams();

  const initialCompareIds = useMemo(() => {
    const paramA = searchParams.get("a");
    const paramB = searchParams.get("b");
    const fallbackA = assets[0]?.id ?? "";
    const a =
      paramA && assets.some((asset) => asset.id === paramA) ? paramA : fallbackA;
    let b =
      paramB && assets.some((asset) => asset.id === paramB) ? paramB : "";
    if (!b || b === a) {
      b = findComparisonPartner(assets, a) ?? assets.find((asset) => asset.id !== a)?.id ?? "";
    }
    return { a, b };
  }, [assets, searchParams]);

  const [assetAId, setAssetAId] = useState(initialCompareIds.a);
  const [assetBId, setAssetBId] = useState(initialCompareIds.b);
  const [versionAId, setVersionAId] = useState("");
  const [versionBId, setVersionBId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assetOptions = useMemo(
    () => assets.map((a) => ({ id: a.id, name: a.name })),
    [assets],
  );

  const assetA = assets.find((a) => a.id === assetAId);
  const assetB = assets.find((a) => a.id === assetBId);
  const resolvedVersionAId = versionAId || (assetA ? getCurrentVersion(assetA).id : "");
  const resolvedVersionBId = versionBId || (assetB ? getCurrentVersion(assetB).id : "");

  const comparisonSummary = useMemo(() => {
    if (!assetA || !assetB) return null;
    return generateComparisonSummary(assetA, assetB, collections);
  }, [assetA, assetB, collections]);

  function getItemLabel(assetId: string, versionId: string) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return assetId;
    const v = asset.versions.find((ver) => ver.id === versionId) ?? getCurrentVersion(asset);
    return `${asset.name} v${v.versionNumber}`;
  }

  function handleDecision(decision: ComparisonDecisionType) {
    setError(null);
    setSuccess(null);

    if (!assetA || !assetB) {
      setError("Please select two valid assets to compare.");
      return;
    }

    const result = submitComparison({
      itemA: {
        assetId: assetAId,
        versionId: resolvedVersionAId,
        label: getItemLabel(assetAId, resolvedVersionAId),
      },
      itemB: {
        assetId: assetBId,
        versionId: resolvedVersionBId,
        label: getItemLabel(assetBId, resolvedVersionBId),
      },
      decision,
      reason,
    });
    if (!result.ok) {
      setError(result.error ?? "Unable to submit comparison.");
      return;
    }
    setSuccess(`Comparison recorded: ${comparisonDecisionLabel(decision)}`);
    setReason("");
  }

  return (
    <AppShell
      title="Asset Comparison"
      description="Side-by-side curator comparison — human judgment, not automated ranking."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="compare-a" className="mb-1 block text-xs text-zinc-500">Asset A</label>
            <Select id="compare-a" value={assetAId} onChange={(e) => { setAssetAId(e.target.value); setVersionAId(""); }}>
              {assetOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </Select>
            {assetA && assetA.versions.length > 1 && (
              <Select className="mt-2" value={resolvedVersionAId} onChange={(e) => setVersionAId(e.target.value)} aria-label="Version A">
                {assetA.versions.map((v) => (
                  <option key={v.id} value={v.id}>v{v.versionNumber} — {v.label}</option>
                ))}
              </Select>
            )}
          </div>
          <div>
            <label htmlFor="compare-b" className="mb-1 block text-xs text-zinc-500">Asset B</label>
            <Select id="compare-b" value={assetBId} onChange={(e) => { setAssetBId(e.target.value); setVersionBId(""); }}>
              {assetOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </Select>
            {assetB && assetB.versions.length > 1 && (
              <Select className="mt-2" value={resolvedVersionBId} onChange={(e) => setVersionBId(e.target.value)} aria-label="Version B">
                {assetB.versions.map((v) => (
                  <option key={v.id} value={v.id}>v{v.versionNumber} — {v.label}</option>
                ))}
              </Select>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ComparisonPanel assetId={assetAId} versionId={resolvedVersionAId} label="Option A" />
          <ComparisonPanel assetId={assetBId} versionId={resolvedVersionBId} label="Option B" />
        </div>

        {comparisonSummary && <AIComparisonSummaryPanel summary={comparisonSummary} />}

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold">Comparison Decision</h3>
            <p className="text-xs text-zinc-500">A reason is required before confirming</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain your comparison decision..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Comparison reason"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => handleDecision("PREFER_A")}>Prefer A</Button>
              <Button variant="primary" onClick={() => handleDecision("PREFER_B")}>Prefer B</Button>
              <Button variant="secondary" onClick={() => handleDecision("KEEP_BOTH")}>Keep Both</Button>
              <Button variant="danger" onClick={() => handleDecision("REJECT_BOTH")}>Reject Both</Button>
            </div>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            {success && <p className="text-sm text-emerald-600" role="status">{success}</p>}
          </CardContent>
        </Card>

        {comparisons.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">Recent Comparisons</h3>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {comparisons.slice(0, 5).map((c) => (
                  <li key={c.id} className="py-3 first:pt-0">
                    <p className="text-sm font-medium">{comparisonDecisionLabel(c.decision)}</p>
                    <p className="text-xs text-zinc-500">{c.itemA.label} vs {c.itemB.label}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.reason}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
