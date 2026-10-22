import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jobStateMatchesWorkspace,
  membershipsHonouredFor,
  parseUserRole,
  selectWorkspace,
} from "../lib/server/workspace-policy";

/**
 * P0.2 — unit tests for the pure workspace authorization policy.
 * No database, no Auth.js, no request context: lib/server/workspace-policy.ts
 * is dependency-light on purpose so these run under `node --test`.
 */

const DEMO_EMAILS = ["demo@assetpilot.ai", "curator@assetpilot.ai", "admin@assetpilot.ai"];

describe("parseUserRole", () => {
  it("accepts the three known roles", () => {
    assert.equal(parseUserRole("VIEWER"), "VIEWER");
    assert.equal(parseUserRole("CURATOR"), "CURATOR");
    assert.equal(parseUserRole("ADMIN"), "ADMIN");
  });

  it("rejects unknown or missing roles", () => {
    assert.equal(parseUserRole("SUPERADMIN"), null);
    assert.equal(parseUserRole(""), null);
    assert.equal(parseUserRole(null), null);
    assert.equal(parseUserRole(undefined), null);
  });
});

describe("membershipsHonouredFor", () => {
  it("honours every account while demo mode is enabled", () => {
    for (const email of DEMO_EMAILS) {
      assert.equal(membershipsHonouredFor(email, true), true);
    }
    assert.equal(membershipsHonouredFor("someone@example.com", true), true);
  });

  it("ignores seeded demo identities when demo mode is disabled", () => {
    for (const email of DEMO_EMAILS) {
      assert.equal(membershipsHonouredFor(email, false), false);
    }
    assert.equal(membershipsHonouredFor("DEMO@ASSETPILOT.AI", false), false);
  });

  it("still honours ordinary accounts when demo mode is disabled", () => {
    assert.equal(membershipsHonouredFor("someone@example.com", false), true);
    assert.equal(membershipsHonouredFor(null, false), true);
  });
});

describe("selectWorkspace", () => {
  const user = { id: "u1", email: "someone@example.com", role: "CURATOR" };
  const membership = { workspaceId: "ws-a" };

  it("returns null when signed out", () => {
    assert.equal(selectWorkspace(null, [membership], true), null);
    assert.equal(selectWorkspace(undefined, [membership], true), null);
  });

  it("returns null when the user id is missing", () => {
    assert.equal(selectWorkspace({ role: "ADMIN" }, [membership], true), null);
  });

  it("returns null when the role is unknown", () => {
    assert.equal(
      selectWorkspace({ id: "u1", email: "x@y.z", role: "BOGUS" }, [membership], true),
      null,
    );
  });

  it("returns null when the account has no memberships", () => {
    assert.equal(selectWorkspace(user, [], true), null);
  });

  it("returns null for demo identities outside demo mode", () => {
    const demo = { id: "u1", email: "demo@assetpilot.ai", role: "VIEWER" };
    assert.equal(selectWorkspace(demo, [membership], false), null);
    const selected = selectWorkspace(demo, [membership], true);
    assert.deepEqual(selected, { userId: "u1", workspaceId: "ws-a", role: "VIEWER" });
  });

  it("picks the first (earliest-joined) membership", () => {
    const selected = selectWorkspace(user, [{ workspaceId: "ws-first" }, { workspaceId: "ws-second" }], true);
    assert.equal(selected?.workspaceId, "ws-first");
  });

  it("keeps the session role (capability) separate from membership (access)", () => {
    const admin = { id: "u1", email: "a@b.c", role: "ADMIN" };
    assert.equal(selectWorkspace(admin, [membership], false)?.role, "ADMIN");
  });

  it("trusts the user id, never a client-provided workspace id", () => {
    const selected = selectWorkspace(user, [membership], true);
    assert.deepEqual(selected, { userId: "u1", workspaceId: "ws-a", role: "CURATOR" });
  });
});

describe("jobStateMatchesWorkspace", () => {
  it("matches only an identical workspace pair", () => {
    assert.equal(jobStateMatchesWorkspace({ workspaceId: "ws-a" }, "ws-a"), true);
    assert.equal(jobStateMatchesWorkspace({ workspaceId: "ws-a" }, "ws-b"), false);
  });

  it("fails closed for states without workspace context", () => {
    assert.equal(jobStateMatchesWorkspace({ workspaceId: null }, "ws-a"), false);
    assert.equal(jobStateMatchesWorkspace({}, "ws-a"), false);
    assert.equal(jobStateMatchesWorkspace(null, "ws-a"), false);
    assert.equal(jobStateMatchesWorkspace(undefined, "ws-a"), false);
  });

  it("fails closed when the reader has no workspace", () => {
    assert.equal(jobStateMatchesWorkspace({ workspaceId: "ws-a" }, null), false);
    assert.equal(jobStateMatchesWorkspace({ workspaceId: "ws-a" }, undefined), false);
  });
});
