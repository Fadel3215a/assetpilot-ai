import { AssetDetailPage } from "@/components/asset-detail-page";
import { generateStaticAssetParams } from "@/lib/static-params";

export function generateStaticParams() {
  return generateStaticAssetParams();
}

export default async function AssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssetDetailPage assetId={id} />;
}
