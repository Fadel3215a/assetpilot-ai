import type { UserRole } from "@/types";
import { isDemoModeEnabled } from "@/lib/demo-mode";

/**
 * Server-only demo identities for the Credentials login.
 *
 * The plaintext passwords live here (server bundle only) and are handed to the
 * login dialog as props by the root layout, which provides them exclusively in
 * demo mode. They must never be imported from client components.
 */
export interface DemoAccount {
  label: string;
  name: string;
  role: UserRole;
  email: string;
  password: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    label: "Demo",
    name: "Demo User",
    role: "VIEWER",
    email: "demo@assetpilot.ai",
    password: "demo1234",
  },
  {
    label: "Curator",
    name: "Curator User",
    role: "CURATOR",
    email: "curator@assetpilot.ai",
    password: "curator1234",
  },
  {
    label: "Admin",
    name: "Admin User",
    role: "ADMIN",
    email: "admin@assetpilot.ai",
    password: "admin1234",
  },
];

export function getDemoAccounts(): readonly DemoAccount[] {
  return isDemoModeEnabled() ? DEMO_ACCOUNTS : [];
}

export function isDemoAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return DEMO_ACCOUNTS.some((account) => account.email === normalized);
}
