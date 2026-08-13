"use client";

import { useAssets } from "@/lib/assets-context";
import type { AssetHealthStatus } from "@/types";
import { Card, CardContent, CardHeader } from "./ui/card";

interface AssetHealthPanelProps {
  assetId: string;
}

const statusStyles: Record<AssetHealthStatus, string> = {
  complete: "text-emerald-600 dark:text-emerald-400",
  partial: "text-amber-600 dark:text-amber-400",
  missing: "text-red-600 dark:text-red-400",
  pending: "text-zinc-500 dark:text-zinc-400",
};

export function AssetHealthPanel({ assetId }: AssetHealthPanelProps) {
  const { getAssetHealth } = useAssets();
  const health = getAssetHealth(assetId);

  if (!health) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Asset Health</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Calculated from current session data — {health.completeCount} of {health.totalCount}{" "}
          criteria complete.
        </p>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          {health.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-zinc-600 dark:text-zinc-400">{item.label}</dt>
              <dd className={`font-medium capitalize ${statusStyles[item.status]}`}>
                {item.detail ?? item.status}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
