import { CollectionDetailPage } from "@/components/collection-detail-page";

export default async function CollectionRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionDetailPage collectionId={id} />;
}
