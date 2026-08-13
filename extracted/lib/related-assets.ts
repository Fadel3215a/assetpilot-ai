import type { Asset, Collection, RelatedAsset } from "@/types";
import { getCurrentVersion } from "@/lib/utils";

function keywordOverlap(a: string, b: string): string[] {
  const wordsA = new Set(
    a.toLowerCase().split(/\W+/).filter((w) => w.length > 3),
  );
  const wordsB = b.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return wordsB.filter((w) => wordsA.has(w));
}

export function findRelatedAssets(
  assets: Asset[],
  assetId: string,
  collections: Collection[],
  limit = 5,
): RelatedAsset[] {
  const source = assets.find((a) => a.id === assetId);
  if (!source) return [];

  const sourceVersion = getCurrentVersion(source);
  const sourceDesc = sourceVersion.metadata.description;
  const sourceCollection = collections.find((c) => c.id === source.collectionId);

  const scored: RelatedAsset[] = [];

  for (const other of assets) {
    if (other.id === assetId) continue;

    const reasons: string[] = [];
    let score = 0;

    if (other.collectionId === source.collectionId) {
      score += 3;
      reasons.push(`Same collection: ${sourceCollection?.name ?? "Unknown"}`);
    }

    const sharedTags = source.tags.filter((t) => other.tags.includes(t));
    if (sharedTags.length > 0) {
      score += sharedTags.length * 2;
      reasons.push(`Shares ${sharedTags.length} tag${sharedTags.length > 1 ? "s" : ""}: ${sharedTags.join(", ")}`);
    }

    if (other.type === source.type) {
      score += 1;
      reasons.push(`Same asset type: ${source.type}`);
    }

    const otherDesc = getCurrentVersion(other).metadata.description;
    const overlap = keywordOverlap(sourceDesc, otherDesc);
    if (overlap.length > 0) {
      score += overlap.length;
      reasons.push(`Similar description keywords: ${overlap.slice(0, 3).join(", ")}`);
    }

    if (score > 0) {
      scored.push({
        assetId: other.id,
        assetName: other.name,
        reasons,
        score,
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
