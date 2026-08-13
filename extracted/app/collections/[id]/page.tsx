import { CollectionDetailPage } from "@/components/collection-detail-page";
import { generateStaticCollectionParams } from "@/lib/static-params";

export function generateStaticParams() {
  return generateStaticCollectionParams();
}

export default async function CollectionRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionDetailPage collectionId={id} />;
}
