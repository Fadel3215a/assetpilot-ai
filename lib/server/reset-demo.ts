import { enrichMockAssets } from "@/data/asset-enrichment";
import { collections } from "@/data/collections";
import { mockActivity, rawMockAssets } from "@/data/mock-assets";
import { mockComparisons } from "@/data/mock-comparisons";
import { withTransaction } from "@/lib/db";
import { parseSessionState } from "@/lib/server/mappers";
import {
  activityToRow,
  assetColumns,
  comparisonToRow,
  historyToRow,
  toJsonInput,
  versionToRow,
} from "@/lib/server/persist";

export async function resetDemoData(): Promise<void> {
  // Seeding wipes every table and recreates the full demo dataset inside a
  // single interactive transaction. Against remote Postgres (e.g. Neon) the
  // per-statement network latency can exceed the default 120s budget, so the
  // reset runs with a generous timeout to allow the operation to complete.
  await withTransaction(
    async (tx) => {
      await tx.curatorFeedbackEntry.deleteMany();
      await tx.decisionHistoryEntry.deleteMany();
      await tx.assetVersion.deleteMany();
      await tx.activityItem.deleteMany();
      await tx.comparisonRecord.deleteMany();
      await tx.ignoredDuplicate.deleteMany();
      await tx.asset.deleteMany();
      await tx.collection.deleteMany();

      await tx.collection.createMany({
        data: collections.map((c) => ({ ...c })),
      });

      const seededAssets = enrichMockAssets(rawMockAssets);
      for (const asset of seededAssets) {
        await tx.asset.create({
          data: {
            ...assetColumns(asset),
            aiSessionState: toJsonInput(parseSessionState(null)),
            versions: {
              create: asset.versions.map((v) => versionToRow(v)),
            },
            decisionHistory: {
              create: asset.decisionHistory.map(historyToRow),
            },
          },
        });
      }

      if (mockComparisons.length > 0) {
        await tx.comparisonRecord.createMany({
          data: mockComparisons.map(comparisonToRow),
        });
      }

      if (mockActivity.length > 0) {
        await tx.activityItem.createMany({
          data: mockActivity.map(activityToRow),
        });
      }
    },
    { timeout: 300_000 },
  );
}
