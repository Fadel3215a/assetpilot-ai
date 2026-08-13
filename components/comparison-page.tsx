"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAssets } from "@/lib/assets-context";
import { getAIAnalysisProvider } from "@/lib/ai";
import { metadataCompleteness } from "@/lib/quality";
import { comparisonDecisionLabel } from "@/lib/production";
import { assetTypeLabel, findComparisonPartner, getCurrentVersion } from "@/lib/utils";
import { AIComparisonSummaryPanel } from "@/components/ai-comparison-summary";
import { AssetThumbnail } from "@/components/asset-thumbnail";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
      <div className="py-8 text-center text-sm text-muted">
        Asset not found
      </div>
    );
  }

  const version = asset.versions.find((v) => v.id === versionId) ?? getCurrentVersion(asset);
  const metaComplete = metadataCompleteness(version.metadata);

  return (
    <article className="space-y-4">
      <div>
        <p className="section-label">{label}</p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">{asset.name}</h3>
      </div>
      <div className="hero-preview visual-hover rounded-md border border-border">
        <AssetThumbnail
          src={version.previewPath}
          alt={asset.name}
          type={asset.type}
          className="aspect-video w-full lg:min-h-[16rem]"
        />
      </div>
      <div className="space-y-2 text-sm">
        <p className="text-muted">{assetTypeLabel(asset.type)} · v{version.versionNumber}</p>
        <div className="flex items-center gap-2">
          <StatusBadge status={asset.status} />
          <span className="text-muted">
            Score: {version.curatorScore ?? version.qualityScore.overall}
          </span>
        </div>
        <p className="text-muted">Metadata: {metaComplete}% complete</p>
        <div className="flex flex-wrap gap-1">
          {asset.tags.map((t) => (
            <span key={t} className="tag-muted">{t}</span>
          ))}
        </div>
        <Link href={`/curation/${asset.id}`} className="inline-block text-xs text-accent hover:underline">
          Open review workspace
        </Link>
      </div>
    </article>
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
    return getAIAnalysisProvider().compare(assetA, assetB, collections);
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

    if (assetAId === assetBId) {
      setError("Choose two different assets. An asset cannot be compared with itself.");
      return;
    }

    if (!reason.trim()) {
      setError("A comparison reason is required before confirming your decision.");
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
      description="Art-direction review — compare two assets side by side. AI suggestions are labeled separately; the curator decides."
      headerSize="display"
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Compare Assets" },
      ]}
    >
      <div className="space-y-8">
        {assets.length < 2 ? (
          <div className="py-8 text-center text-sm text-muted">
            At least two assets are needed to compare.{" "}
            <Link href="/assets" className="text-accent hover:underline">
              Return to Asset Library
            </Link>
          </div>
        ) : (
          <>
        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="compare-a" className="mb-1 block text-xs font-medium text-muted">Asset A</label>
            <Select
              id="compare-a"
              value={assetAId}
              onChange={(e) => {
                const nextA = e.target.value;
                setAssetAId(nextA);
                setVersionAId("");
                if (assetBId === nextA) {
                  const partner = findComparisonPartner(assets, nextA);
                  setAssetBId(partner ?? assets.find((a) => a.id !== nextA)?.id ?? "");
                }
              }}
            >
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
            <label htmlFor="compare-b" className="mb-1 block text-xs font-medium text-muted">Asset B</label>
            <Select
              id="compare-b"
              value={assetBId}
              onChange={(e) => {
                setAssetBId(e.target.value);
                setVersionBId("");
              }}
            >
              {assetOptions.filter((o) => o.id !== assetAId).map((o) => (
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

        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
          <ComparisonPanel assetId={assetAId} versionId={resolvedVersionAId} label="Option A" />
          <div className="compare-versus hidden lg:flex lg:min-h-[16rem] lg:items-center">
            versus
          </div>
          <ComparisonPanel assetId={assetBId} versionId={resolvedVersionBId} label="Option B" />
        </div>

        {comparisonSummary && <AIComparisonSummaryPanel summary={comparisonSummary} />}

        <div className="panel-curator space-y-4 p-4">
          <div>
            <h3 className="section-title">Curator Comparison Decision</h3>
            <p className="text-xs text-muted">Human review required — explain your judgment before confirming</p>
          </div>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain your comparison decision..."
            className="field-textarea"
            aria-label="Comparison reason"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => handleDecision("PREFER_A")}>Prefer A</Button>
            <Button variant="primary" onClick={() => handleDecision("PREFER_B")}>Prefer B</Button>
            <Button variant="secondary" onClick={() => handleDecision("KEEP_BOTH")}>Keep Both</Button>
            <Button variant="danger" onClick={() => handleDecision("REJECT_BOTH")}>Reject Both</Button>
          </div>
          {error && <p className="text-sm text-status-danger" role="alert">{error}</p>}
          {success && <p className="text-sm text-status-success" role="status">{success}</p>}
        </div>

        {comparisons.length > 0 && (
          <section className="editorial-section">
            <h3 className="section-title">Recent Comparisons</h3>
            <ul className="mt-4 divide-y divide-border">
              {comparisons.slice(0, 5).map((c) => (
                <li key={c.id} className="py-3 first:pt-0">
                  <p className="text-sm font-medium">{comparisonDecisionLabel(c.decision)}</p>
                  <p className="text-xs text-muted">{c.itemA.label} vs {c.itemB.label}</p>
                  <p className="mt-1 text-sm text-muted">{c.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
          </>
        )}
      </div>
    </AppShell>
  );
}
