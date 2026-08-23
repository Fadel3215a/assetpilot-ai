import { AssetDetailPage } from "@/components/asset-detail-page";

export default async function AssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssetDetailPage assetId={id} />;
}
