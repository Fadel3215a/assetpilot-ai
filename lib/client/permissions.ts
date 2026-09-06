"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { ROLE_LEVEL, type UserRole } from "@/types";
import { useLoginGate } from "@/components/providers/login-gate";

export type ProtectedActionRole = "CURATOR" | "ADMIN";

/**
 * Stage 3.3 — client-side session role for UI permission guarding.
 *
 * The authoritative role is whatever Auth.js stamped into the session
 * (JWT/session callbacks in auth.ts). When signed out, the effective role falls
 * back to the same demo default the server uses (DEMO_USER_ROLE env, default
 * ADMIN) so the sample workspace stays usable without logging in. Real
 * authorization is always enforced server-side (proxy.ts + lib/auth.ts); this
 * only drives UI affordances.
 */
const DEMO_ROLE_FALLBACK: UserRole = "ADMIN";

export interface EffectiveRole {
  role: UserRole;
  sessionRole: UserRole | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signedIn: boolean;
  canRead: boolean;
  canCurate: boolean;
  canAdminister: boolean;
}

export function useEffectiveRole(): EffectiveRole {
  const { data: session, status } = useSession();
  const sessionRole = (session?.user?.role as UserRole | undefined) ?? null;
  const role: UserRole = sessionRole ?? DEMO_ROLE_FALLBACK;
  const level = ROLE_LEVEL[role];

  return {
    role,
    sessionRole,
    status,
    signedIn: status === "authenticated",
    canRead: level >= ROLE_LEVEL.VIEWER,
    canCurate: level >= ROLE_LEVEL.CURATOR,
    canAdminister: level >= ROLE_LEVEL.ADMIN,
  };
}

/**
 * Hook for role-protected write controls. Returns:
 *   - `allowed` / `locked` — whether the current effective role meets the gate.
 *   - `guard()` — run from an onClick: passes through when allowed, otherwise
 *     opens the shared LoginModal and aborts (returns false).
 *   - `lockHint` — tooltip/title text shown on the locked control.
 *   - `role` — the session-augmented effective role (for labels/badges).
 */
export function useProtectedAction(required: ProtectedActionRole) {
  const { canCurate, canAdminister, role } = useEffectiveRole();
  const { openLogin } = useLoginGate();

  const allowed = required === "ADMIN" ? canAdminister : canCurate;
  const lockHint = required === "ADMIN"
    ? "Requires the ADMIN role."
    : "Requires the CURATOR or ADMIN role. Sign in or switch account to continue.";

  const guard = useCallback((): boolean => {
    if (allowed) return true;
    openLogin();
    return false;
  }, [allowed, openLogin]);

  return { allowed, locked: !allowed, lockHint, guard, role, canCurate, canAdminister, openLogin };
}