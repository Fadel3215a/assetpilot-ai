"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DemoResetButton } from "./demo-reset-button";

const navItems = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/assets", label: "Asset Library", icon: LibraryIcon },
  { href: "/curation", label: "Curation Queue", icon: QueueIcon },
  { href: "/collections", label: "Collections", icon: CollectionsIcon },
  { href: "/reviews", label: "Reviews", icon: ReviewsIcon },
  { href: "/production-ready", label: "Production Ready", icon: ReadyIcon },
];

function DashboardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

function CollectionsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function ReviewsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function ReadyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-0.5 px-3 py-2">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`relative flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] hover:translate-x-0.5 hover:bg-surface-elevated/60 motion-reduce:transition-none motion-reduce:transform-none ${
              active
                ? "font-medium text-foreground"
                : "text-muted hover:text-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <span
                className="absolute left-0 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-md border border-border bg-surface p-2 text-foreground transition-[transform,background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] hover:border-accent/30 hover:bg-surface-elevated active:scale-[0.94] motion-reduce:transition-none motion-reduce:transform-none lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-expanded={mobileOpen}
        aria-controls="sidebar-nav"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
          {mobileOpen ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="page-fade fixed inset-0 z-40 bg-background/80 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="sidebar-nav"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-background transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out-quart)] motion-reduce:transition-none lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-[10px] font-bold text-accent-foreground">
            AP
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-foreground">AssetPilot</p>
            <p className="text-[10px] uppercase tracking-wider text-muted">Creative workspace</p>
          </div>
        </div>
        {nav}
        <div className="mt-auto space-y-2 border-t border-border px-4 py-4">
          <DemoResetButton />
          <p className="text-[11px] leading-relaxed text-muted">
            Portfolio demo — simulated AI, session-only state.
          </p>
        </div>
      </aside>
    </>
  );
}
