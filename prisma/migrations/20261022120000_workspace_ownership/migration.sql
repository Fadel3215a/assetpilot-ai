-- P0.2 — Workspace ownership and data isolation, step 1 of 2 (ADDITIVE ONLY,
-- BACKWARD COMPATIBLE).
--
-- Creates the Workspace / WorkspaceMember ownership model, adds nullable
-- workspaceId columns to every owned table, backfills all existing rows into a
-- single controlled "legacy" workspace, adds demo-account memberships (honoured
-- only while demo mode is enabled — see lib/server/workspace-context.ts), and
-- adds indexes + FKs. The composite uniqueness key new code needs on
-- IgnoredDuplicate is added here as a plain UNIQUE INDEX, so the new build can
-- run its (workspaceId, duplicateId) upserts before the primary key is swapped.
--
-- NOT NULL enforcement and the IgnoredDuplicate primary-key swap live in the
-- follow-up migration `20261022120100_workspace_ownership_enforce`, which must
-- be applied ONLY after the new application build is live. Until then the old
-- build keeps working unchanged and the new build already works against the
-- looser schema: the pre-deploy window has no write failures on either build.
--
-- No row is deleted, truncated, or dropped. Safe to re-run only as part of
-- `prisma migrate deploy` (Prisma records execution once).

-- 1. New tables ------------------------------------------------------------

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- 2. Nullable ownership columns (backfilled in step 3) ----------------------

ALTER TABLE "Asset" ADD COLUMN "workspaceId" TEXT;

ALTER TABLE "Collection" ADD COLUMN "workspaceId" TEXT;

ALTER TABLE "ActivityItem" ADD COLUMN "workspaceId" TEXT;

ALTER TABLE "ComparisonRecord" ADD COLUMN "workspaceId" TEXT;

ALTER TABLE "IgnoredDuplicate" ADD COLUMN "workspaceId" TEXT;

-- 3. Backfill every unowned row into the controlled legacy workspace ---------
--
-- The legacy workspace is created only when unowned rows exist, and reuses an
-- existing `legacy` slug (however its id was generated) so this never collides
-- with a workspace created by seeding or `workspace:grant`.

DO $$
DECLARE
    ws_id TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM "Asset" WHERE "workspaceId" IS NULL)
        OR EXISTS (SELECT 1 FROM "Collection" WHERE "workspaceId" IS NULL)
        OR EXISTS (SELECT 1 FROM "ActivityItem" WHERE "workspaceId" IS NULL)
        OR EXISTS (SELECT 1 FROM "ComparisonRecord" WHERE "workspaceId" IS NULL)
        OR EXISTS (SELECT 1 FROM "IgnoredDuplicate" WHERE "workspaceId" IS NULL)
    THEN
        SELECT "id" INTO ws_id FROM "Workspace" WHERE "slug" = 'legacy';

        IF ws_id IS NULL THEN
            INSERT INTO "Workspace" ("id", "slug", "name", "isLegacy", "createdAt", "updatedAt")
            VALUES ('ws-legacy', 'legacy', 'Legacy workspace', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO NOTHING
            RETURNING "id" INTO ws_id;
        END IF;

        IF ws_id IS NULL THEN
            SELECT "id" INTO ws_id FROM "Workspace" WHERE "id" = 'ws-legacy';
        END IF;

        IF ws_id IS NULL THEN
            RAISE EXCEPTION 'workspace backfill: could not resolve the legacy workspace';
        END IF;

        UPDATE "Asset" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
        UPDATE "Collection" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
        UPDATE "ActivityItem" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
        UPDATE "ComparisonRecord" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
        UPDATE "IgnoredDuplicate" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
    END IF;
END $$;

-- 3b. Seeded demo identities get legacy membership rows; runtime resolves
--     these ONLY while demo mode is enabled (production builds ignore them).
--     No other user receives any membership — nothing is visible to an account
--     until `npm run workspace:grant -- <email> <slug>` grants access.

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId")
SELECT 'wsm-' || u."id", ws."id", u."id"
FROM "User" u
JOIN "Workspace" ws ON ws."slug" = 'legacy'
WHERE lower(u."email") IN ('demo@assetpilot.ai', 'curator@assetpilot.ai', 'admin@assetpilot.ai')
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

-- 4. Ownership uniqueness new code depends on --------------------------------
--
-- New code upserts ignored duplicates on (workspaceId, duplicateId). The
-- composite PRIMARY KEY (and NOT NULL enforcement) arrive with the follow-up
-- migration, so a plain UNIQUE INDEX backs those upserts in the meantime. Rows
-- written by the old build keep a NULL workspaceId (allowed by the unique
-- index) and are re-owned by the follow-up migration.

CREATE UNIQUE INDEX "IgnoredDuplicate_workspaceId_duplicateId_key" ON "IgnoredDuplicate"("workspaceId", "duplicateId");

-- 5. Indexes (ownership lookups + listing) ----------------------------------

CREATE INDEX "Collection_workspaceId_idx" ON "Collection"("workspaceId");

CREATE INDEX "Asset_workspaceId_idx" ON "Asset"("workspaceId");

CREATE INDEX "ActivityItem_workspaceId_idx" ON "ActivityItem"("workspaceId");

CREATE INDEX "ComparisonRecord_workspaceId_idx" ON "ComparisonRecord"("workspaceId");

-- 6. Foreign keys (validated after the backfill; children cascade with their
--    workspace, asset-scoped rows already cascade through Asset) -------------

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Collection" ADD CONSTRAINT "Collection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityItem" ADD CONSTRAINT "ActivityItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComparisonRecord" ADD CONSTRAINT "ComparisonRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IgnoredDuplicate" ADD CONSTRAINT "IgnoredDuplicate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reversal (manual; Prisma has no down migrations, run only if explicitly
-- rolling back P0.2 — never run against a workspace you still need. Apply the
-- follow-up migration's reversal first, then this one):
--
--   ALTER TABLE "IgnoredDuplicate"  DROP CONSTRAINT "IgnoredDuplicate_workspaceId_fkey";
--   ALTER TABLE "ComparisonRecord"  DROP CONSTRAINT "ComparisonRecord_workspaceId_fkey";
--   ALTER TABLE "ActivityItem"      DROP CONSTRAINT "ActivityItem_workspaceId_fkey";
--   ALTER TABLE "Asset"             DROP CONSTRAINT "Asset_workspaceId_fkey";
--   ALTER TABLE "Collection"        DROP CONSTRAINT "Collection_workspaceId_fkey";
--   ALTER TABLE "WorkspaceMember"   DROP CONSTRAINT "WorkspaceMember_userId_fkey";
--   ALTER TABLE "WorkspaceMember"   DROP CONSTRAINT "WorkspaceMember_workspaceId_fkey";
--   DROP INDEX IF EXISTS "IgnoredDuplicate_workspaceId_duplicateId_key";
--   DROP INDEX IF EXISTS "ComparisonRecord_workspaceId_idx";
--   DROP INDEX IF EXISTS "ActivityItem_workspaceId_idx";
--   DROP INDEX IF EXISTS "Asset_workspaceId_idx";
--   DROP INDEX IF EXISTS "Collection_workspaceId_idx";
--   ALTER TABLE "IgnoredDuplicate"  DROP COLUMN "workspaceId";
--   ALTER TABLE "ComparisonRecord"  DROP COLUMN "workspaceId";
--   ALTER TABLE "ActivityItem"      DROP COLUMN "workspaceId";
--   ALTER TABLE "Asset"             DROP COLUMN "workspaceId";
--   ALTER TABLE "Collection"        DROP COLUMN "workspaceId";
--   DROP TABLE IF EXISTS "WorkspaceMember";
--   DROP TABLE IF EXISTS "Workspace";
