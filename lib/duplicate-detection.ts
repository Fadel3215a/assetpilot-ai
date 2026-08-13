import type { Asset, Collection, DuplicateCandidate } from "@/types";
import { getCurrentVersion } from "@/lib/utils";

function versionFingerprint(asset: Asset): string {
  const v = getCurrentVersion(asset);
  const m = v.metadata;
  const dims = m.dimensions ? `${m.dimensions.width}x${m.dimensions.height}` : "";
  return [m.fileName ?? asset.name, m.fileSize, m.mimeType ?? m.format, dims].join("|");
}

export function findDuplicateCandidates(
  assets: Asset[],
  assetId: string,
  ignoredIds: Set<string>,
): DuplicateCandidate[] {
  const source = assets.find((a) => a.id === assetId);
  if (!source) return [];

  const sourceVersion = getCurrentVersion(source);
  const sourceMeta = sourceVersion.metadata;
  const candidates: DuplicateCandidate[] = [];

  for (const other of assets) {
    if (other.id === assetId) continue;

    const candidateId = `${assetId}::${other.id}`;
    if (ignoredIds.has(candidateId)) continue;

    const otherVersion = getCurrentVersion(other);
    const otherMeta = otherVersion.metadata;
    const evidence: string[] = [];

    const sourceFileName = (sourceMeta.fileName ?? source.name).toLowerCase();
    const otherFileName = (otherMeta.fileName ?? other.name).toLowerCase();
    if (sourceFileName === otherFileName) {
      evidence.push(`Same filename: "${sourceMeta.fileName ?? source.name}"`);
    }

    if (
      sourceMeta.fileSize === otherMeta.fileSize &&
      sourceMeta.fileSize > 0
    ) {
      evidence.push(`Matching file size: ${sourceMeta.fileSize} bytes`);
    }

    const sourceMime = sourceMeta.mimeType ?? sourceMeta.format;
    const otherMime = otherMeta.mimeType ?? otherMeta.format;
    if (sourceMime && otherMime && sourceMime.toLowerCase() === otherMime.toLowerCase()) {
      evidence.push(`Same MIME/format: ${sourceMime}`);
    }

    if (
      sourceMeta.dimensions &&
      otherMeta.dimensions &&
      sourceMeta.dimensions.width === otherMeta.dimensions.width &&
      sourceMeta.dimensions.height === otherMeta.dimensions.height
    ) {
      evidence.push(
        `Matching dimensions: ${sourceMeta.dimensions.width} × ${sourceMeta.dimensions.height}`,
      );
    }

    if (source.collectionId === other.collectionId) {
      evidence.push("Same collection");
    }

    if (source.versions.length > 1 || other.versions.length > 1) {
      if (versionFingerprint(source) === versionFingerprint(other)) {
        evidence.push("Matching version metadata fingerprint");
      }
    }

    if (evidence.length >= 2 || (evidence.length === 1 && sourceFileName === otherFileName)) {
      candidates.push({
        id: candidateId,
        assetId,
        candidateAssetId: other.id,
        candidateName: other.name,
        reason: "Metadata similarity detected.",
        evidence,
      });
    }
  }

  return candidates;
}

export function countPossibleDuplicates(assets: Asset[], ignoredIds: Set<string>): number {
  const seen = new Set<string>();
  let count = 0;
  for (const asset of assets) {
    const dupes = findDuplicateCandidates(assets, asset.id, ignoredIds);
    for (const d of dupes) {
      const key = [d.assetId, d.candidateAssetId].sort().join("::");
      if (!seen.has(key)) {
        seen.add(key);
        count++;
      }
    }
  }
  return count;
}

export function getAssetsWithMetadataIssues(assets: Asset[], collections: Collection[]): number {
  return assets.filter((asset) => {
    const v = getCurrentVersion(asset);
    const hasDescription = v.metadata.description.trim().length > 0;
    const hasTags = asset.tags.length >= 2;
    const collection = collections.find((c) => c.id === asset.collectionId);
    return !hasDescription || !hasTags || !collection;
  }).length;
}
