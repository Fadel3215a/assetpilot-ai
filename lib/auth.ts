import { auth } from "@/auth";
import { ROLE_LEVEL, type SessionUser, type UserRole } from "@/types";

/**
 * Stage 4.3 + Stage 3.1 — RBAC permission mapping and server-context assertion
 * helpers.
 *
 * Roles rank VIEWER < CURATOR < ADMIN (see types/auth.ts). A role grants every
 * permission assigned to lower-ranked roles, so a single threshold check covers
 * inheritance: canRead = level >= VIEWER, canCurate = level >= CURATOR,
 * canAdminister = level >= ADMIN.
 *
 * Authorization is deny-by-default: the caller's role comes from the active
 * Auth.js session (JWT stamps id + role) or, for service-to-service traffic,
 * from a valid `x-api-key` matching the `API_KEYS` allowlist. Client-supplied
 * role/identity headers are never trusted.
 */

export const API_KEY_HEADER = "x-api-key";

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

/** Returns ADMIN when the request carries a configured service API key. */
export function apiKeyRoleFromRequest(request: Request): UserRole | null {
  const key = request.headers.get(API_KEY_HEADER);
  if (!key) return null;
  const keys = (process.env.API_KEYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return keys.length > 0 && keys.includes(key) ? "ADMIN" : null;
}

/**
 * Reads the role of the active Auth.js session, or null when signed out. This
 * is the authoritative role for browser callers. Wrapped defensively because
 * auth() requires a request-scoped cookie context that some call paths lack.
 */
export async function sessionRole(): Promise<UserRole | null> {
  try {
    const session = await auth();
    return parseRole(session?.user?.role);
  } catch {
    return null;
  }
}

/** Resolves the current request's role; throws 401 when signed out. */
export async function resolveServerRole(): Promise<UserRole> {
  const role = await sessionRole();
  if (!role) {
    throw new AuthError("Authentication required.", 401, "UNAUTHENTICATED");
  }
  return role;
}

/** Builder for the SessionUser view; throws 401 when signed out. */
export async function resolveSessionUser(): Promise<SessionUser> {
  const session = await auth();
  const role = parseRole(session?.user?.role);
  if (!session?.user?.id || !role) {
    throw new AuthError("Authentication required.", 401, "UNAUTHENTICATED");
  }
  return {
    id: session.user.id,
    name: session.user.name ?? "User",
    email: session.user.email ?? undefined,
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
 * Authorization is sourced from the active Auth.js session or a configured
 * service API key; client-supplied role headers are ignored.
 */
export async function requireRequestRole(
  request: Request,
  required: UserRole,
): Promise<{ ok: true; role: UserRole } | Response> {
  const role = (await sessionRole()) ?? apiKeyRoleFromRequest(request);
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
