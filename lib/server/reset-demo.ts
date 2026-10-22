import { enrichMockAssets } from "@/data/asset-enrichment";
import { collections } from "@/data/collections";
import { mockActivity, rawMockAssets } from "@/data/mock-assets";
import { mockComparisons } from "@/data/mock-comparisons";
import { withTransaction } from "@/lib/db";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { hashPassword } from "@/lib/passwords";
import { DEMO_ACCOUNTS } from "@/lib/server/demo-accounts";
import { indexCollection } from "@/lib/search";
import { parseSessionState } from "@/lib/server/mappers";
import {
  activityToRow,
  assetColumns,
  comparisonToRow,
  historyToRow,
  toJsonInput,
  versionToRow,
} from "@/lib/server/persist";

/**
 * P0.2 — resets ONE workspace: every content row owned by `workspaceId` is
 * wiped and the demo dataset is recreated inside it.
 *
 * Deliberately NOT global anymore:
 *   - rows are filtered by workspaceId (assets, collections, activity,
 *     comparisons, ignored duplicates; nested rows cascade via their asset);
 *   - users are NEVER bulk-deleted. Only the seeded demo identities are
 *     upserted and only THEIR sessions/accounts/tokens are cleared, so a reset
 *     can neither destroy production accounts nor touch another workspace.
 */
export async function resetDemoData(workspaceId: string): Promise<void> {
  // Demo data (and the demo identities below) only exist in demo mode. This
  // prevents `prisma db seed` / the reset action from wiping a production
  // database or re-creating known-credential accounts.
  if (!isDemoModeEnabled()) {
    throw new Error(
      "Demo data reset is disabled. Set NEXT_PUBLIC_DEMO_MODE=true to enable demo mode.",
    );
  }

  // Stage 3.1 — demo identities for the Credentials login. Passwords are
  // stored only as bcrypt hashes.
  const demoUsers = await Promise.all(
    DEMO_ACCOUNTS.map(async (account) => ({
      email: account.email,
      name: account.name,
      password: await hashPassword(account.password),
      role: account.role,
    })),
  );
  const demoEmails = demoUsers.map((u) => u.email);

  // Seeding wipes the workspace's content and recreates the full demo dataset
  // inside a single interactive transaction. Against remote Postgres (e.g.
  // Neon) the per-statement network latency can exceed the default 120s
  // budget, so the reset runs with a generous timeout.
  let seededAssets: ReturnType<typeof enrichMockAssets> = [];
  await withTransaction(
    async (tx) => {
      await tx.curatorFeedbackEntry.deleteMany({ where: { asset: { workspaceId } } });
      await tx.decisionHistoryEntry.deleteMany({ where: { asset: { workspaceId } } });
      await tx.assetVersion.deleteMany({ where: { asset: { workspaceId } } });
      await tx.activityItem.deleteMany({ where: { workspaceId } });
      await tx.comparisonRecord.deleteMany({ where: { workspaceId } });
      await tx.ignoredDuplicate.deleteMany({ where: { workspaceId } });
      await tx.asset.deleteMany({ where: { workspaceId } });
      await tx.collection.deleteMany({ where: { workspaceId } });

      // Demo identities: upserted, never globally deleted. Stale credentials
      // for these accounts (old password hashes, sessions) are invalidated.
      const demoUserIds: string[] = [];
      for (const user of demoUsers) {
        const row = await tx.user.upsert({
          where: { email: user.email },
          create: { email: user.email, name: user.name, password: user.password, role: user.role },
          update: { name: user.name, password: user.password, role: user.role },
        });
        demoUserIds.push(row.id);
      }
      await tx.session.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.account.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.verificationToken.deleteMany({ where: { identifier: { in: demoEmails } } });

      // Demo identities must be able to resolve THIS workspace, including on a
      // freshly seeded database where the ownership migration had no rows to
      // backfill. Upserts keep other workspaces and memberships untouched.
      for (const userId of demoUserIds) {
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId, userId } },
          create: { id: `wsm-${workspaceId}-${userId}`, workspaceId, userId },
          update: {},
        });
      }

      await tx.collection.createMany({
        data: collections.map((c) => ({ ...c, workspaceId })),
      });

      seededAssets = enrichMockAssets(rawMockAssets);
      for (const asset of seededAssets) {
        await tx.asset.create({
          data: {
            ...assetColumns(asset),
            workspaceId,
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
          data: mockComparisons.map((c) => ({ ...comparisonToRow(c), workspaceId })),
        });
      }

      if (mockActivity.length > 0) {
        await tx.activityItem.createMany({
          data: mockActivity.map((a) => ({ ...activityToRow(a), workspaceId })),
        });
      }
    },
    { timeout: 300_000 },
  );

  // Hybrid search index (embedding + searchText) for the restored inventory,
  // computed after the transaction commits so the asset rows exist.
  await indexCollection(seededAssets, collections);
}
