"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { Card, CardContent, CardHeader } from "./ui/card";

interface RelatedAssetsPanelProps {
  assetId: string;
}

export function RelatedAssetsPanel({ assetId }: RelatedAssetsPanelProps) {
  const { getRelatedAssets } = useAssets();
  const related = getRelatedAssets(assetId);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Related Assets</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Deterministic metadata similarity — collection, tags, type, and description keywords.
        </p>
      </CardHeader>
      <CardContent>
        {related.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No related assets found from current metadata.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {related.map((item) => (
              <li key={item.assetId} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/assets/${item.assetId}`}
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {item.assetName}
                </Link>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Why related?</p>
                <ul className="mt-1 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
                  {item.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
