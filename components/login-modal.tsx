"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const quickAccounts = [
  { label: "Demo", role: "VIEWER", email: "demo@assetpilot.ai", password: "demo1234" },
  { label: "Curator", role: "CURATOR", email: "curator@assetpilot.ai", password: "curator1234" },
  { label: "Admin", role: "ADMIN", email: "admin@assetpilot.ai", password: "admin1234" },
] as const;

/**
 * Stage 3.2 — Credentials sign-in dialog. Submits to the Auth.js credentials
 * provider with redirect:false so failures render inline, then refreshes the
 * server tree so the identity bar and server reads pick up the new session.
 *
 * The dialog unmounts when closed, so email/password/error reset on reopen.
 */
export function LoginModal({ open, onClose }: LoginModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(emailValue: string, passwordValue: string) {
    setPending(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email: emailValue,
        password: passwordValue,
        redirect: false,
      });
      if (result?.ok) {
        setEmail("");
        setPassword("");
        onClose();
        router.refresh();
      } else {
        setError(result?.error ?? "Sign in failed. Check your credentials and try again.");
      }
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="page-fade fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-5 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Sign in</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="rounded p-1 text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(email, password);
          }}
        >
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="rounded-sm border border-status-danger/30 bg-status-danger-muted px-3 py-2 text-xs leading-relaxed text-foreground">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending || !email || !password} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">One-click demo accounts</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {quickAccounts.map(({ label, role, email: accEmail, password: accPassword }) => (
              <button
                key={accEmail}
                type="button"
                disabled={pending}
                onClick={() => void submit(accEmail, accPassword)}
                className="rounded-md border border-border bg-background px-2 py-2 text-center transition-[border-color,background-color] duration-[var(--duration-fast)] hover:border-accent/30 hover:bg-surface-elevated disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-[10px] uppercase tracking-wider text-muted">{role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}