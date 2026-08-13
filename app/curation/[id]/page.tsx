import { ReviewWorkspacePage } from "@/components/review-workspace-page";
import { generateStaticAssetParams } from "@/lib/static-params";

export function generateStaticParams() {
  return generateStaticAssetParams();
}

export default async function CurationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewWorkspacePage assetId={id} />;
}
