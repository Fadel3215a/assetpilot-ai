import { collections } from "@/data/collections";
import { rawMockAssets } from "@/data/mock-assets";

/** IDs pre-rendered at build time for static export (seeded demo data only). */
export function generateStaticAssetParams() {
  return rawMockAssets.map((asset) => ({ id: asset.id }));
}

export function generateStaticCollectionParams() {
  return collections.map((collection) => ({ id: collection.id }));
}
