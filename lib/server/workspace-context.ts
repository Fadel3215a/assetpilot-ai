import { auth } from "@/auth";
import { apiKeyRoleFromRequest, assertCan, AuthError, parseRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { parseMediaOwnerRef } from "@/lib/media-ownership";
import {
  selectWorkspace,
  type PolicySessionUser,
  type SelectedWorkspace,
} from "@/lib/server/workspace-policy";
import type { UserRole } from "@/types";
import type { Session } from "next-auth";

/**
 * P0.2 — Workspace ownership context.
 *
 * A request's workspace is ALWAYS derived server-side:
 *   - browser traffic  -> the active Auth.js session's user id, resolved
 *     through WorkspaceMember rows (first membership wins);
 *   - service traffic  -> the server-configured `SERVICE_WORKSPACE_SLUG`
 *     (default `legacy`) for a valid `x-api-key`;
 *   - never a client-supplied workspace id or role header.
 *
 * The decision itself lives in the pure lib/server/workspace-policy.ts module;
 * this file only gathers session/membership inputs and exposes guards for
 * actions, routes, and media serving.
 *
 * Missing access is non-disclosing: callers translate "no workspace" into the
 * same generic 404 / "not found" result used for ids that simply do not exist.
 */

export type WorkspaceContext = SelectedWorkspace;

export interface RequestWorkspace {
  ok: true;
  workspaceId: string;
  role: UserRole;
}

export type { PolicyMembership, PolicySessionUser } from "@/lib/server/workspace-policy";
export { membershipsHonouredFor } from "@/lib/server/workspace-policy";

async function readSession(): Promise<Session | null> {
  try {
    return await auth();
  } catch {
    return null;
  }
}

function policyUserOf(session: Session | null): PolicySessionUser | null {
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}

/**
 * Resolves the signed-in caller's workspace, or null when signed out or when
 * the account has no (honoured) workspace membership. Never throws for those
 * cases — read paths render an empty state instead.
 */
export async function resolveWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await readSession();
  const user = policyUserOf(session);
  if (!user?.id) return null;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 1,
    select: { workspaceId: true },
  });

  return selectWorkspace(user, memberships, isDemoModeEnabled());
}

/**
 * Workspace + role assertion for server actions. Throws AuthError:
 *   401 UNAUTHENTICATED when signed out,
 *   403 FORBIDDEN        when the role is insufficient,
 *   403 NO_WORKSPACE     when the account has no workspace membership.
 */
export async function requireWorkspaceAction(required: UserRole): Promise<WorkspaceContext> {
  const ctx = await resolveWorkspaceContext();
  if (ctx) {
    assertCan(required, ctx.role);
    return ctx;
  }
  const session = await readSession();
  if (session?.user?.id) {
    throw new AuthError("No workspace access.", 403, "NO_WORKSPACE");
  }
  throw new AuthError("Authentication required.", 401, "UNAUTHENTICATED");
}

/** Server-configured workspace for service (API-key) callers. */
async function serviceWorkspaceId(): Promise<string | null> {
  const slug = process.env.SERVICE_WORKSPACE_SLUG?.trim() || "legacy";
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true },
  });
  return workspace?.id ?? null;
}

function guardResponse(message: string, status: number, code: string): Response {
  return Response.json({ ok: false, error: message, code }, { status });
}

/**
 * Route-handler guard: validates role (session or service API key) and resolves
 * the caller's workspace. Returns the workspace or an error Response:
 *   401 UNAUTHENTICATED, 403 FORBIDDEN, 403 NO_WORKSPACE.
 */
export async function requireRequestWorkspace(
  request: Request,
  required: UserRole,
): Promise<RequestWorkspace | Response> {
  const session = await readSession();
  const user = policyUserOf(session);
  const sessionRole = user ? parseRole(user.role) : null;

  if (user?.id && sessionRole) {
    try {
      assertCan(required, sessionRole);
    } catch (error) {
      if (error instanceof AuthError) {
        return guardResponse(error.message, error.status, error.code);
      }
      throw error;
    }
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 1,
      select: { workspaceId: true },
    });
    const selected = selectWorkspace(user, memberships, isDemoModeEnabled());
    if (!selected) {
      return guardResponse("No workspace access.", 403, "NO_WORKSPACE");
    }
    return { ok: true, workspaceId: selected.workspaceId, role: selected.role };
  }

  if (apiKeyRoleFromRequest(request)) {
    // Service API key: workspace comes from server config, never the request.
    const workspaceId = await serviceWorkspaceId();
    if (!workspaceId) {
      return guardResponse("No workspace access.", 403, "NO_WORKSPACE");
    }
    try {
      assertCan(required, "ADMIN");
    } catch (error) {
      if (error instanceof AuthError) {
        return guardResponse(error.message, error.status, error.code);
      }
      throw error;
    }
    return { ok: true, workspaceId, role: "ADMIN" };
  }

  return guardResponse("Authentication required.", 401, "UNAUTHENTICATED");
}

/**
 * Non-disclosing 404 for resources that do not exist OR belong to another
 * workspace — both cases answer identically so ids cannot be probed.
 */
export function notFoundResponse(): Response {
  return Response.json(
    { ok: false, error: "Not found.", code: "NOT_FOUND" },
    { status: 404 },
  );
}

/** AuthError-shaped "no workspace" for code paths that surface AuthError. */
export function noWorkspaceError(): AuthError {
  return new AuthError("No workspace access.", 403, "NO_WORKSPACE");
}

/**
 * Resolves the workspace that owns a storage-relative media path, or null when
 * the path matches no known asset/version (unknown paths are indistinguishable
 * from foreign-workspace paths — both surface as 404).
 */
export async function resolveMediaWorkspaceId(relativePath: string): Promise<string | null> {
  const ref = parseMediaOwnerRef(relativePath);
  if (!ref) return null;

  if (ref.kind === "asset") {
    const row = await prisma.asset.findUnique({
      where: { id: ref.assetId },
      select: { workspaceId: true },
    });
    return row?.workspaceId ?? null;
  }

  const rows = await prisma.$queryRaw<Array<{ workspaceId: string }>>`
    SELECT a."workspaceId" AS "workspaceId"
    FROM "AssetVersion" v
    JOIN "Asset" a ON a."id" = v."assetId"
    WHERE ${ref.fileBase} LIKE v."id" || '-%'
    LIMIT 1
  `;
  return rows[0]?.workspaceId ?? null;
}
