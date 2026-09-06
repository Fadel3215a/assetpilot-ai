"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LoginModal } from "@/components/login-modal";

/**
 * Stage 3.3 — Shared sign-in gate for role-protected UI actions.
 *
 * Write controls that are locked for the current role (see
 * lib/client/permissions.ts) call `openLogin()` instead of running, so a
 * VIEWER (or signed-out) user is prompted to sign in / switch account before
 * attempting a CURATOR/ADMIN action. Renders a single global LoginModal.
 */
interface LoginGateContextValue {
  openLogin: () => void;
  closeLogin: () => void;
  isOpen: boolean;
}

const LoginGateContext = createContext<LoginGateContextValue | null>(null);

export function LoginGateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openLogin = useCallback(() => setIsOpen(true), []);
  const closeLogin = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ openLogin, closeLogin, isOpen }),
    [openLogin, closeLogin, isOpen],
  );

  return (
    <LoginGateContext.Provider value={value}>
      {children}
      <LoginModal open={isOpen} onClose={closeLogin} />
    </LoginGateContext.Provider>
  );
}

export function useLoginGate(): LoginGateContextValue {
  const context = useContext(LoginGateContext);
  if (!context) {
    throw new Error("useLoginGate must be used within <LoginGateProvider />");
  }
  return context;
}