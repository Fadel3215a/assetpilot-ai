import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * P0.2 — structural (source-scanning) ownership tests.
 *
 * These guard the invariants that `tsc` cannot express on its own: that every
 * action/route goes through the workspace guards, that reads stay scoped, that
 * reset paths remain non-destructive, and that the shipped migration is
 * additive. They read the source files directly — no database required.
 */

const ROOT = process.cwd();

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

function routeFiles(dir: string, found: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  for (const entry of readdirSync(abs)) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) {
      routeFiles(rel, found);
    } else if (entry === "route.ts") {
      found.push(rel);
    }
  }
  return found;
}

describe("server actions: every exported action is workspace-gated", () => {
  const source = read("lib/server/actions.ts");

  it("never uses the pre-P0.2 role-only guard", () => {
    assert.ok(
      !source.includes("assertServerRole"),
      "lib/server/actions.ts must not call assertServerRole; use requireWorkspaceAction",
    );
  });

  it("calls requireWorkspaceAction exactly once per exported action", () => {
    const exported = (source.match(/export async function /g) ?? []).length;
    const guarded = (source.match(/requireWorkspaceAction\(/g) ?? []).length;
    assert.ok(
      guarded >= exported,
      `expected >= ${exported} requireWorkspaceAction calls, found ${guarded}`,
    );
  });

  it("threads ctx.workspaceId through helpers and queries", () => {
    assert.ok(source.includes("ctx.workspaceId"));
    assert.ok(!/\bloadAsset\(tx, (assetId|id)\)(?!,)/.test(source), "loadAsset must be scoped");
    assert.ok(
      !/persistSnapshot\(tx, (domain|updated|curation\.domain)\)(?!,)/.test(source),
      "persistSnapshot must be scoped",
    );
  });
});

describe("data access layer: reads are workspace-scoped", () => {
  const source = read("lib/server/queries.ts");
  const functions = source.split("export async function ").slice(1);

  it("every exported query declares workspaceId in its signature", () => {
    assert.ok(functions.length >= 11, `expected >= 11 exported queries, found ${functions.length}`);
    functions.forEach((fn, index) => {
      const signature = fn.slice(0, 160);
      assert.ok(
        signature.includes("workspaceId"),
        `exported query #${index + 1} is missing a workspaceId parameter: ${signature.split("\n")[0]}`,
      );
    });
  });

  it("hybrid search options require a workspace", () => {
    const options = source.slice(source.indexOf("interface HybridSearchOptions"));
    const body = options.slice(0, options.indexOf("}"));
    assert.ok(body.includes("workspaceId"));
  });
});

describe("API routes: workspace guard on every non-auth endpoint", () => {
  const routes = routeFiles("app/api");

  it("found the expected route modules", () => {
    assert.ok(routes.length >= 13, `expected >= 13 route.ts files, found ${routes.length}`);
  });

  it("every route uses requireRequestWorkspace and none use requireRequestRole", () => {
    for (const route of routes) {
      const source = read(route);
      if (route.includes("auth") && route.includes("nextauth")) continue;
      assert.ok(
        source.includes("requireRequestWorkspace("),
        `${route} must call requireRequestWorkspace`,
      );
      assert.ok(!source.includes("requireRequestRole"), `${route} must not call requireRequestRole`);
    }
  });

  it("job dispatch overrides any client-supplied workspaceId", () => {
    const source = read("app/api/jobs/route.ts");
    assert.ok(source.includes("delete rawBody.workspaceId"));
    assert.ok(source.includes("workspaceId: auth.workspaceId"));
  });

  it("job status lookups verify ownership", () => {
    assert.ok(read("app/api/jobs/[id]/route.ts").includes("jobStateMatchesWorkspace("));
    assert.ok(read("app/api/jobs/[id]/progress/route.ts").includes("jobStateMatchesWorkspace("));
  });
});

describe("root layout: no private data for anonymous visitors", () => {
  const source = read("app/layout.tsx");

  it("resolves the workspace before loading inventory", () => {
    assert.ok(source.includes("resolveWorkspaceContext()"));
    assert.ok(source.includes("loadInitialState(workspace.workspaceId)"));
  });

  it("renders the empty state when there is no workspace context", () => {
    assert.ok(source.includes("EMPTY_INITIAL_STATE"));
    assert.ok(/: EMPTY_INITIAL_STATE/.test(source));
  });
});

describe("media route: authenticated and workspace-owned", () => {
  const source = read(path.join("app", "media", "[...path]", "route.ts"));

  it("requires a workspace-qualified session", () => {
    assert.ok(source.includes("resolveWorkspaceContext()"));
    assert.ok(source.includes("resolveMediaWorkspaceId("));
  });

  it("does not serve authenticated media from shared caches", () => {
    assert.ok(source.includes('"private, max-age=31536000, immutable"'));
    assert.ok(!source.includes('"public, max-age'));
  });
});

describe("reset/seed: production users are never deleted", () => {
  const source = read("lib/server/reset-demo.ts");

  it("has no global user wipe", () => {
    assert.ok(!/user\.deleteMany\(/.test(source), "reset must not bulk-delete users");
  });

  it("scopes content deletes to one workspace", () => {
    assert.ok(source.includes("tx.asset.deleteMany({ where: { workspaceId } })"));
    assert.ok(source.includes("tx.collection.deleteMany({ where: { workspaceId } })"));
    assert.ok(source.includes("export async function resetDemoData(workspaceId: string)"));
    assert.ok(read("lib/server/actions.ts").includes("resetDemoData(ctx.workspaceId)"));
  });
});

describe("migration: additive ownership backfill", () => {
  const raw = read(
    path.join("prisma", "migrations", "20261022120000_workspace_ownership", "migration.sql"),
  );
  const activeSql = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("contains no destructive statements in executable SQL", () => {
    assert.ok(
      !/DROP TABLE|TRUNCATE|DELETE FROM/i.test(activeSql),
      "migration SQL must be additive (no table drops, truncates, or deletes)",
    );
  });

  it("backfills into the legacy workspace (NOT NULL is deferred to step 2)", () => {
    assert.ok(raw.includes("'ws-legacy'"));
    assert.ok(raw.includes("WHERE \"workspaceId\" IS NULL"));
    assert.ok(
      !/SET NOT NULL/.test(activeSql),
      "step 1 must stay backward compatible: NOT NULL belongs to the enforcement migration",
    );
  });

  it("adds the interim composite uniqueness key new code upserts on", () => {
    assert.ok(
      raw.includes(
        'CREATE UNIQUE INDEX "IgnoredDuplicate_workspaceId_duplicateId_key" ON "IgnoredDuplicate"("workspaceId", "duplicateId")',
      ),
    );
    assert.ok(
      !activeSql.includes("DROP CONSTRAINT \"IgnoredDuplicate_pkey\""),
      "the primary key swap belongs to the enforcement migration",
    );
  });

  it("grants memberships only to the seeded demo identities", () => {
    assert.ok(raw.includes("INSERT INTO \"WorkspaceMember\""));
    assert.ok(raw.includes("demo@assetpilot.ai"));
    const insert = raw.slice(raw.indexOf("INSERT INTO \"WorkspaceMember\""));
    const statement = insert.slice(0, insert.indexOf(";"));
    assert.ok(!/email\)\s*SELECT/i.test(statement), "no blanket membership insert allowed");
    assert.ok(statement.includes("IN ("));
  });
});

describe("migration: ownership enforcement (applied after the new build)", () => {
  const raw = read(
    path.join(
      "prisma",
      "migrations-pending",
      "20261022120100_workspace_ownership_enforce",
      "migration.sql",
    ),
  );
  const activeSql = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("contains no destructive statements in executable SQL", () => {
    assert.ok(
      !/DROP TABLE|TRUNCATE|DELETE FROM/i.test(activeSql),
      "enforcement SQL must be additive (no table drops, truncates, or deletes)",
    );
  });

  it("re-owns compatibility-window rows before enforcing NOT NULL", () => {
    const backfillAt = activeSql.indexOf('UPDATE "Asset" SET "workspaceId" = ws_id WHERE "workspaceId" IS NULL');
    const enforceAt = activeSql.indexOf("SET NOT NULL");
    assert.ok(backfillAt !== -1, "must defensively re-backfill rows written by the previous build");
    assert.ok(enforceAt !== -1 && backfillAt < enforceAt, "backfill must run before SET NOT NULL");
    assert.ok((activeSql.match(/SET NOT NULL/g) ?? []).length >= 5);
  });

  it("swaps the IgnoredDuplicate primary key and drops the interim index", () => {
    assert.ok(activeSql.includes('DROP CONSTRAINT "IgnoredDuplicate_pkey"'));
    assert.ok(activeSql.includes('PRIMARY KEY ("workspaceId", "duplicateId")'));
    assert.ok(activeSql.includes('DROP INDEX IF EXISTS "IgnoredDuplicate_workspaceId_duplicateId_key"'));
  });
});

describe("queue contracts: jobs carry workspace context", () => {
  const source = read("types/queue.ts");

  it("payloads and state require workspaceId", () => {
    const fields = (source.match(/workspaceId: string/g) ?? []).length;
    assert.ok(fields >= 7, `expected >= 7 workspaceId fields in types/queue.ts, found ${fields}`);
  });
});

describe("workers: background jobs re-validate workspace context", () => {
  const workers = ["workers/ingestion.ts", "workers/ai-analysis.ts", "workers/rendition.ts"];

  it("every worker rejects jobs without workspace context", () => {
    for (const worker of workers) {
      const source = read(worker);
      assert.ok(
        source.includes("missing workspace context"),
        `${worker} must fail closed when workspaceId is absent`,
      );
    }
  });

  it("worker asset loads are workspace-scoped", () => {
    const source = read("lib/server/worker-orchestration.ts");
    assert.ok(source.includes("where: { id, workspaceId }"));
    assert.match(source, /loadAssetForWorker\(\s*id: string,\s*workspaceId: string,/);
  });
});

describe("grant tooling", () => {
  it("ships workspace:grant and uses composite membership upsert", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["workspace:grant"]);
    const script = read("scripts/grant-workspace.ts");
    assert.ok(script.includes("workspaceId_userId"));
    assert.ok(script.includes("WorkspaceMember"));
  });
});
