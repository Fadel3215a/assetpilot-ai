/**
 * Stage 4.3 — Role-based access control model.
 *
 * Defines the three enterprise roles and how they rank so permission checks can
 * be expressed as simple level comparisons (ADMIN > CURATOR > VIEWER).
 */

export type UserRole = "VIEWER" | "CURATOR" | "ADMIN";

export const ROLES: readonly UserRole[] = ["VIEWER", "CURATOR", "ADMIN"] as const;

/** Numeric rank per role; higher roles inherit lower roles' permissions. */
export const ROLE_LEVEL: Record<UserRole, number> = {
  VIEWER: 1,
  CURATOR: 2,
  ADMIN: 3,
};

/** Identifies a caller within a server context (request header/session). */
export interface SessionUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}
