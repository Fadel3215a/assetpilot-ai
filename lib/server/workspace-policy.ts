import { ROLE_LEVEL, type UserRole } from "@/types";
import { isDemoAccountEmail } from "@/lib/server/demo-accounts";

/**
 * P0.2 — Pure workspace authorization policy.
 *
 * Everything here is side-effect free and dependency-light (no Prisma, no
 * Auth.js) so ownership rules can be unit-tested without a database or a
 * request context. The async wrappers in lib/server/workspace-context.ts fetch
 * sessions/memberships and delegate the decision to this module.
 */

export interface PolicySessionUser {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface PolicyMembership {
  workspaceId: string;
}

export interface SelectedWorkspace {
  userId: string;
  workspaceId: string;
  role: UserRole;
}

/** Parses a raw role string, returning null for unknown/missing values. */
export function parseUserRole(value: string | null | undefined): UserRole | null {
  if (value && value in ROLE_LEVEL) return value as UserRole;
  return null;
}

/**
 * Seeded demo identities only have their memberships honoured while demo mode
 * is enabled; production builds ignore those rows entirely.
 */
export function membershipsHonouredFor(
  email: string | null | undefined,
  demoModeEnabled: boolean,
): boolean {
  if (demoModeEnabled) return true;
  return !isDemoAccountEmail(email);
}

/**
 * Picks the caller's workspace from their session and ordered memberships
 * (first membership wins). Returns null — meaning "no workspace access" —
 * when signed out, when the role is unknown, when demo mode hides the
 * account's memberships, or when the account belongs to no workspace.
 *
 * `memberships` must be ordered by ascending join time (the resolver query
 * applies that order); this function never reorders on purpose so the policy
 * stays a pure head-of-list decision.
 */
export function selectWorkspace(
  session: PolicySessionUser | null | undefined,
  memberships: readonly PolicyMembership[],
  demoModeEnabled: boolean,
): SelectedWorkspace | null {
  const userId = session?.id ?? null;
  const role = parseUserRole(session?.role);
  if (!userId || !role) return null;
  if (!membershipsHonouredFor(session?.email, demoModeEnabled)) return null;

  const first = memberships[0];
  if (!first?.workspaceId) return null;

  return { userId, workspaceId: first.workspaceId, role };
}

/**
 * Job states carry the workspace that enqueued them; a reader may only observe
 * a job whose workspace matches their own. Unknown/legacy states (no recorded
 * workspace) never match.
 */
export function jobStateMatchesWorkspace(
  state: { workspaceId?: string | null } | null | undefined,
  workspaceId: string | null | undefined,
): boolean {
  if (!state?.workspaceId || !workspaceId) return false;
  return state.workspaceId === workspaceId;
}
