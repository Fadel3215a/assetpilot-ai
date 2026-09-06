"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

/**
 * Stage 3.2 — Client-side Auth.js session context.
 *
 * Wraps the app shell so any client component can read the active session via
 * useSession(). refetchOnWindowFocus keeps the identity bar in sync when the
 * session changes from another tab or a quick-login action.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider refetchOnWindowFocus>{children}</NextAuthSessionProvider>
  );
}