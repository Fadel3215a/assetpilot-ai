"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useHotkeys } from "@/lib/hotkeys-context";

/**
 * Stage 3.1 — Hotkeys cheat-sheet modal.
 *
 * Compact glassmorphic reference panel listing the global keyboard shortcuts.
 * Opened via `?` (or a sidebar link) and closed with Esc, ?, or a backdrop click.
 */

interface ShortcutRow {
  keys: string[];
  label: string;
}

const GLOBAL: ShortcutRow[] = [
  { keys: ["Space"], label: "Toggle detail drawer for active asset" },
  { keys: ["J", "↓"], label: "Next asset (move focus forward)" },
  { keys: ["K", "↑"], label: "Previous asset (move focus backward)" },
  { keys: ["E"], label: "Export inventory as ZIP" },
  { keys: ["R"], label: "Re-index vectors" },
  { keys: ["?"], label: "Toggle this shortcut reference" },
];

const PALETTE: ShortcutRow[] = [
  { keys: ["⌘", "K"], label: "Open command palette" },
  { keys: ["Esc"], label: "Close overlays" },
];

export function HotkeyLegendModal() {
  const { legendOpen, closeLegend } = useHotkeys();

  useEffect(() => {
    if (!legendOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [legendOpen]);

  return (
    <AnimatePresence>
      {legendOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/55 p-4 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          onClick={closeLegend}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface/95 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.6)] backdrop-blur-md"
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-semibold tracking-tight text-foreground">
                Keyboard Shortcuts
              </p>
              <button
                type="button"
                onClick={closeLegend}
                aria-label="Close shortcut reference"
                className="rounded-sm border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-muted transition-colors hover:text-foreground"
              >
                ESC
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              <RowGroup title="Global" rows={GLOBAL} />
              <RowGroup title="Command palette" rows={PALETTE} />
            </div>

            <div className="border-t border-border bg-surface-elevated/40 px-4 py-2 text-[10px] text-muted">
              Shortcuts are ignored while typing in a text field or search box.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RowGroup({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{row.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-surface-elevated px-1.5 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  );
}