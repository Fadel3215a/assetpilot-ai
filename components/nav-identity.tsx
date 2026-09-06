"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginModal } from "./login-modal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { UserRole } from "@/types";

const roleColor: Record<UserRole, string> = {
  VIEWER: "#8b9aab",
  CURATOR: "#00f5a0",
  ADMIN: "#fbbf24",
};

/**
 * Stage 3.2 — Session-aware identity bar for the AppShell top navigation.
 *
 * Signed out: a "Sign In" button that opens the Credentials login modal.
 * Signed in: the user's name/email plus a role badge, with "Switch Account"
 * (re-opens the modal) and "Sign Out" actions.
 */
export function NavIdentity() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [modalOpen, setModalOpen] = useState(false);

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.refresh();
  }

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2" aria-live="polite" aria-busy="true">
        <div className="h-4 w-24 animate-pulse rounded-sm bg-surface-elevated" />
        <div className="h-4 w-12 animate-pulse rounded-sm bg-surface-elevated" />
      </div>
    );
  }

  if (status === "authenticated" && session?.user) {
    const user = session.user;
    const role = (user.role as UserRole | undefined) ?? "VIEWER";
    return (
      <>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-foreground">
              {user.name ?? "User"}
            </p>
            {user.email && (
              <p className="text-xs leading-tight text-muted">{user.email}</p>
            )}
          </div>
          <Badge color={roleColor[role]}>{role}</Badge>
          <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => setModalOpen(true)}>
            Switch Account
          </Button>
          <Button variant="secondary" className="px-2.5 py-1.5" onClick={() => void handleSignOut()}>
            Sign Out
          </Button>
        </div>
        <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setModalOpen(true)}>
        Sign In
      </Button>
      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}