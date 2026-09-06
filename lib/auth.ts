import { headers } from "next/headers";
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
 * Since Stage 3.1 the caller's role is resolved from the active Auth.js session
 * via auth() when one exists (JWT stamps id + role). Where no session is active
 * the helpers fall back to the `x-user-role` request header (set by proxy.ts or
 * passed explicitly by service-to-service callers), and finally to the
 * `DEMO_USER_ROLE` env override so the sample workspace remains usable without
 * a login system.
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

/**
 * Reads the role of the active Auth.js session, or null when signed out. This
 * is the authoritative role when a session cookie is present; header and env
 * fallbacks below apply otherwise. Wrapped defensively because auth() requires
 * a request-scoped cookie context that some non-request call paths lack.
 */
export async function sessionRole(): Promise<UserRole | null> {
  try {
    const session = await auth();
    return parseRole(session?.user?.role);
  } catch {
    return null;
  }
}

/** Resolves the current request's role in a server action (via next/headers). */
export async function resolveServerRole(): Promise<UserRole> {
  const session = await sessionRole();
  if (session) return session;
  const h = await headers();
  return getRoleFromHeaders(h) ?? demoRole();
}

/** Builder for the SessionUser view of the current request. */
export async function resolveSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (session?.user?.id) {
    return {
      id: session.user.id,
      name: session.user.name ?? "User",
      email: session.user.email ?? undefined,
      role: parseRole(session.user.role) ?? demoRole(),
    };
  }
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
 * Authorization is sourced from the active Auth.js session first; when no
 * session exists the `x-user-role` header (proxy-attached or explicit) is
 * honored, preserving the pre-NextAuth service-to-service call pattern.
 */
export async function requireRequestRole(
  request: Request,
  required: UserRole,
): Promise<{ ok: true; role: UserRole } | Response> {
  const session = await sessionRole();
  const role = session ?? getRoleFromRequest(request);
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
