import { headers } from "next/headers";
import { ROLE_LEVEL, type SessionUser, type UserRole } from "@/types";

/**
 * Stage 4.3 — RBAC permission mapping and server-context assertion helpers.
 *
 * Roles rank VIEWER < CURATOR < ADMIN (see types/auth.ts). A role grants every
 * permission assigned to lower-ranked roles, so a single threshold check covers
 * inheritance: canRead = level >= VIEWER, canCurate = level >= CURATOR,
 * canAdminister = level >= ADMIN.
 *
 * The caller's role is sourced from the `x-user-role` request header (set by
 * proxy.ts after validating the incoming session/API token). Where proxy has not
 * run (e.g. some server-action call sites) it falls back to the `DEMO_USER_ROLE`
 * env override so the sample workspace remains usable without a login system.
 */

export const ROLE_HEADER = "x-user-role";
export const API_KEY_HEADER = "x-api-key";

const DEMO_ROLE_ENV = "DEMO_USER_ROLE";

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 403, code = "FORBIDDEN") {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

/** Parses a raw role string, returning null when it isn't a known role. */
export function parseRole(value: string | null | undefined): UserRole | null {
  if (value && value in ROLE_LEVEL) return value as UserRole;
  return null;
}

export function canRead(role: UserRole | null | undefined): boolean {
  return !!role && ROLE_LEVEL[role] >= ROLE_LEVEL.VIEWER;
}

export function canCurate(role: UserRole | null | undefined): boolean {
  return !!role && ROLE_LEVEL[role] >= ROLE_LEVEL.CURATOR;
}

export function canAdminister(role: UserRole | null | undefined): boolean {
  return !!role && ROLE_LEVEL[role] >= ROLE_LEVEL.ADMIN;
}

/**
 * Throws AuthError when the supplied role is missing or below the required
 * threshold. Use inside server functions/routes to enforce authorization.
 */
export function assertCan(required: UserRole, role: UserRole | null | undefined): void {
  if (!role) {
    throw new AuthError("Authentication required.", 401, "UNAUTHENTICATED");
  }
  if (ROLE_LEVEL[role] < ROLE_LEVEL[required]) {
    throw new AuthError(`Requires the ${required} role or higher.`, 403, "FORBIDDEN");
  }
}

/** Reads the caller's role from an arbitrary Headers object. */
export function getRoleFromHeaders(h: Headers): UserRole | null {
  return parseRole(h.get(ROLE_HEADER));
}

/** Reads the caller's role from a Request (route handlers / proxy). */
export function getRoleFromRequest(request: Request): UserRole | null {
  return getRoleFromHeaders(request.headers);
}

function demoRole(): UserRole {
  const envRole = parseRole(process.env[DEMO_ROLE_ENV]);
  return envRole ?? "ADMIN";
}

/** Resolves the current request's role in a server action (via next/headers). */
export async function resolveServerRole(): Promise<UserRole> {
  const h = await headers();
  return getRoleFromHeaders(h) ?? demoRole();
}

/** Builder for the SessionUser view of the current request. */
export async function resolveSessionUser(): Promise<SessionUser> {
  const h = await headers();
  const role = getRoleFromHeaders(h) ?? demoRole();
  return {
    id: h.get("x-user-id") ?? "system",
    name: h.get("x-user-name") ?? "Demo User",
    email: h.get("x-user-email") ?? undefined,
    role,
  };
}

/**
 * Server-action assertion helper. Call at the top of any action that must be
 * restricted; throws AuthError on insufficient privileges.
 */
export async function assertServerRole(required: UserRole): Promise<void> {
  assertCan(required, await resolveServerRole());
}

/**
 * Route-handler assertion helper. Validates the Request's role and returns a
 * JSON error Response (suitable for immediate return) or null when allowed.
 */
export function requireRequestRole(
  request: Request,
  required: UserRole,
): { ok: true; role: UserRole } | Response {
  const role = getRoleFromRequest(request);
  if (!role) {
    return unauthorized(`Authentication required.`);
  }
  try {
    assertCan(required, role);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorized(error.message, error);
    }
    throw error;
  }
  return { ok: true, role };
}

function unauthorized(message: string, cause?: AuthError): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message, code: cause?.code ?? "UNAUTHORIZED" }),
    {
      status: cause?.status ?? 401,
      headers: { "content-type": "application/json" },
    },
  );
}
