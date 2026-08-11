import { ReviewWorkspacePage } from "@/components/review-workspace-page";

export default async function CurationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewWorkspacePage assetId={id} />;
}
