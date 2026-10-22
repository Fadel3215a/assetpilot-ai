-- P0.2 — Workspace ownership enforcement, step 2 of 2.
--
-- APPLY ONLY AFTER the P0.2 application build is live. Step 1
-- (`20261022120000_workspace_ownership`) is fully backward compatible, so the
-- old build keeps working until it is replaced. This migration tightens the
-- schema the new build expects:
--
--   1. defensively re-owns any rows the OLD build inserted between step 1 and
--      the deploy (they carry a NULL workspaceId) into the legacy workspace;
--   2. enforces NOT NULL on every workspaceId;
--   3. swaps IgnoredDuplicate's primary key to (workspaceId, duplicateId) and
--      drops the interim unique index step 1 created.
--
-- No row is deleted, truncated, or dropped. Backfill before enforcement means
-- SET NOT NULL cannot fail on rows written during the compatibility window.

-- 1. Defensive re-ownership (idempotent) -------------------------------------
--
-- Mirrors step 1's backfill. The legacy workspace always exists by now when
-- data exists, but the block stays self-contained for freshly created
-- databases and for rows written by the previous build in the window.

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
            RAISE EXCEPTION 'workspace enforcement: could not resolve the legacy workspace';
        END IF;

        UPDATE "Asset" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
        UPDATE "Collection" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
        UPDATE "ActivityItem" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
        UPDATE "ComparisonRecord" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
        UPDATE "IgnoredDuplicate" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL;
    END IF;
END $$;

-- 2. Ownership is now mandatory ---------------------------------------------

ALTER TABLE "Asset" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "Collection" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "ActivityItem" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "ComparisonRecord" ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "IgnoredDuplicate" ALTER COLUMN "workspaceId" SET NOT NULL;

-- 3. IgnoredDuplicate identity becomes per-workspace -------------------------
--
-- The ignore flag is scoped to a workspace, so identity is the pair
-- (workspaceId, duplicateId). Only the PRIMARY KEY constraint is swapped; no
-- data is touched. The interim unique index from step 1 is now redundant (the
-- new primary key covers the same columns) and is dropped to match the model.

ALTER TABLE "IgnoredDuplicate" DROP CONSTRAINT "IgnoredDuplicate_pkey";

ALTER TABLE "IgnoredDuplicate" ADD CONSTRAINT "IgnoredDuplicate_pkey" PRIMARY KEY ("workspaceId", "duplicateId");

DROP INDEX IF EXISTS "IgnoredDuplicate_workspaceId_duplicateId_key";

-- Reversal (manual; Prisma has no down migrations — run only as part of
-- rolling P0.2 back entirely, and only after the previous build is restored):
--
--   ALTER TABLE "IgnoredDuplicate" DROP CONSTRAINT "IgnoredDuplicate_pkey";
--   ALTER TABLE "IgnoredDuplicate" ADD CONSTRAINT "IgnoredDuplicate_pkey" PRIMARY KEY ("duplicateId");
--   ALTER TABLE "Asset"            ALTER COLUMN "workspaceId" DROP NOT NULL;
--   ALTER TABLE "Collection"       ALTER COLUMN "workspaceId" DROP NOT NULL;
--   ALTER TABLE "ActivityItem"     ALTER COLUMN "workspaceId" DROP NOT NULL;
--   ALTER TABLE "ComparisonRecord" ALTER COLUMN "workspaceId" DROP NOT NULL;
--   ALTER TABLE "IgnoredDuplicate" ALTER COLUMN "workspaceId" DROP NOT NULL;
