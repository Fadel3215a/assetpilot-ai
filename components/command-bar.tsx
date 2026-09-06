"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAssets } from "@/lib/assets-context";
import { applyTheme, getStoredTheme, initTheme, type AppTheme } from "@/lib/theme";
import { getCurrentVersion } from "@/lib/utils";
import type { Asset, AssetType } from "@/types";
import { AssetTypeIcon } from "./asset-type-icon";

const MAX_ASSET_RESULTS = 6;
const MAX_COLLECTION_RESULTS = 4;

type PaletteItem =
  | {
      kind: "asset";
      id: string;
      label: string;
      hint: string;
      iconType: AssetType;
      onSelect: () => void;
    }
  | {
      kind: "collection";
      id: string;
      label: string;
      hint: string;
      onSelect: () => void;
    }
  | {
      kind: "action";
      id: string;
      label: string;
      hint?: string;
      onSelect: () => void;
    };

function matchAsset(asset: Asset, query: string, collectionName: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const version = getCurrentVersion(asset);
  const haystack = [asset.name, asset.type, ...asset.tags, collectionName, version.metadata.description]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function SunMoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" />
    </svg>
  );
}

export function CommandBar() {
  const router = useRouter();
  const { assets, collections } = useAssets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [theme, setTheme] = useState<AppTheme>(() =>
    typeof window === "undefined" ? "dark" : getStoredTheme(),
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const collectionMap = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  );

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    setStatusText(null);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setExportJobId(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    initTheme();
  }, []);

  // Global Cmd/Ctrl+K listener + Escape when open.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!open) openPalette();
      }
      if (event.key === "Escape") {
        closePalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette, closePalette]);

  // Lock body scroll while the palette is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const assetHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...assets].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return sorted
      .filter((a) => matchAsset(a, q, collectionMap.get(a.collectionId)?.name ?? ""))
      .slice(0, MAX_ASSET_RESULTS);
  }, [assets, query, collectionMap]);

  const collectionHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return collections
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
      .slice(0, MAX_COLLECTION_RESULTS);
  }, [collections, query]);

  const triggerReindex = useCallback(async () => {
    if (busyAction) return;
    setBusyAction("reindex");
    setStatusText(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-job-type": "REINDEX_VECTORS" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setStatusText("Re-index failed to start.");
        return;
      }
      setStatusText("Vector re-index started — progress appears in the sidebar.");
    } catch {
      setStatusText("Re-index failed to start.");
    } finally {
      setBusyAction(null);
    }
  }, [busyAction]);

  const triggerExport = useCallback(async () => {
    if (busyAction) return;
    setBusyAction("export");
    setStatusText(null);
    setExportJobId(null);
    try {
      const ids = [...new Set(assets.map((a) => a.id))];
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-job-type": "EXPORT_ZIP" },
        body: JSON.stringify({ assetIds: ids }),
      });
      if (!res.ok) {
        setStatusText("Export failed to start.");
        return;
      }
      const payload = (await res.json()) as { ok: boolean; jobId?: string };
      if (payload.jobId) {
        setExportJobId(payload.jobId);
        setStatusText("Preparing ZIP…");
      } else {
        setStatusText("Export started.");
      }
    } catch {
      setStatusText("Export failed to start.");
    } finally {
      setBusyAction(null);
    }
  }, [assets, busyAction]);

  // Poll the export job and hand the completed ZIP to the browser.
  useEffect(() => {
    if (!exportJobId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(exportJobId)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          job?: { status?: string; result?: { fileName?: string; base64?: string } };
        };
        const job = payload.job;
        if (job?.status !== "COMPLETED" || !job.result?.base64) return;
        const bytes = Uint8Array.from(atob(job.result.base64), (ch) => ch.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = job.result.fileName ?? "assetpilot-export.zip";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        setStatusText("ZIP downloaded.");
      } catch {
        // best-effort poll
      }
    })();
    return () => controller.abort();
  }, [exportJobId]);

  const toggleTheme = useCallback(() => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    setStatusText(`Switched to ${next} theme.`);
  }, [theme]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = assetHits.map((asset) => ({
      kind: "asset",
      id: `asset-${asset.id}`,
      label: asset.name,
      hint: collectionMap.get(asset.collectionId)?.name ?? asset.type,
      iconType: asset.type,
      onSelect: () => {
        closePalette();
        void router.push(`/assets/${asset.id}`);
      },
    }));
    collectionHits.forEach((c) => {
      list.push({
        kind: "collection",
        id: `collection-${c.id}`,
        label: c.name,
        hint: c.description,
        onSelect: () => {
          closePalette();
          void router.push(`/collections/${c.id}`);
        },
      });
    });
    list.push({
      kind: "action",
      id: "action-reindex",
      label: "Re-index Vectors",
      hint: "Background job · CURATOR",
      onSelect: () => void triggerReindex(),
    });
    list.push({
      kind: "action",
      id: "action-export",
      label: "Export ZIP",
      hint: "Download current inventory",
      onSelect: () => void triggerExport(),
    });
    list.push({
      kind: "action",
      id: "action-theme",
      label: theme === "dark" ? "Toggle Dark Theme → Light" : "Toggle → Dark Theme",
      hint: theme === "dark" ? "Switch to light UI" : "Switch to dark UI",
      onSelect: toggleTheme,
    });
    return list;
  }, [assetHits, collectionHits, collectionMap, theme, router, closePalette, triggerReindex, triggerExport, toggleTheme]);

  const sectionItems = useMemo(
    () => ({
      assets: items.filter((i) => i.kind === "asset"),
      collections: items.filter((i) => i.kind === "collection"),
      actions: items.filter((i) => i.kind === "action"),
    }),
    [items],
  );

  const clampedActive = Math.min(activeIndex, Math.max(0, items.length - 1));
  const activeItem = items[clampedActive] ?? null;

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (items.length ? (prev - 1 + items.length) % items.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeItem) activeItem.onSelect();
    }
  }

  function renderSection(title: string, list: PaletteItem[]): React.ReactNode {
    if (list.length === 0) return null;
    return (
      <div className="px-2 pb-2 pt-3">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
          {title}
        </p>
        <div className="space-y-0.5">
          {list.map((item) => {
            const idx = items.indexOf(item);
            const active = idx === clampedActive;
            return (
              <button
                key={item.id}
                type="button"
                id={`command-item-${item.id}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => item.onSelect()}
                className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors duration-[var(--duration-fast)] ${
                  active ? "bg-accent/15 text-foreground" : "text-muted hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                {item.kind === "asset" ? (
                  <span className="text-muted">
                    <AssetTypeIcon type={item.iconType} />
                  </span>
                ) : (
                  <span className="text-muted">
                    {item.kind === "collection" ? <CollectionsIcon /> : <ActionGlyph prefix={item.id} />}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{item.label}</span>
                  {item.hint && <span className="block truncate text-[11px] text-muted">{item.hint}</span>}
                </span>
                {item.kind === "action" && busyAction && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-[border-color,color] duration-[var(--duration-fast)] hover:border-accent/30 hover:text-foreground"
      >
        <span className="text-muted">
          <SearchIcon />
        </span>
        <span className="hidden md:inline">Search…</span>
        <span className="hidden rounded-sm border border-border bg-surface-elevated px-1 py-0.5 text-[10px] font-medium text-muted lg:inline">
          ⌘K
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={closePalette}
            role="presentation"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[0_32px_80px_-24px_rgba(0,0,0,0.6)]"
              initial={{ opacity: 0, y: -14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
                <span className="text-muted">
                  <SearchIcon />
                </span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onInputKeyDown}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="command-bar-listbox"
                  aria-activedescendant={
                    activeItem ? `command-item-${activeItem.id}` : undefined
                  }
                  placeholder="Search assets, collections, or run a command…"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
                />
                <button
                  type="button"
                  onClick={closePalette}
                  aria-label="Close command palette"
                  className="rounded-sm border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-muted hover:text-foreground"
                >
                  ESC
                </button>
              </div>

              <div
                id="command-bar-listbox"
                role="listbox"
                aria-label="Results"
                className="overflow-y-auto"
              >
                {items.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted">
                    No matching assets, collections, or commands.
                  </p>
                )}
                {renderSection("Assets", sectionItems.assets)}
                {renderSection("Collections", sectionItems.collections)}
                {renderSection("Actions", sectionItems.actions)}
              </div>

              {statusText && (
                <div className="border-t border-border px-3.5 py-2">
                  <p className="text-xs" role="status" aria-live="polite">
                    <span className="font-medium text-accent">{statusText}</span>
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 border-t border-border bg-surface-elevated/40 px-3.5 py-2 text-[10px] text-muted">
                <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
                <span><Kbd>↵</Kbd> select</span>
                <span><Kbd>esc</Kbd> close</span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="text-muted">
                    <BoltIcon />
                  </span>
                  AI-powered asset curation
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border bg-surface px-1 font-mono text-[9px] text-muted">
      {children}
    </kbd>
  );
}

function CollectionsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function ActionGlyph({ prefix }: { prefix: string }) {
  if (prefix.includes("reindex")) return <BoltIcon />;
  if (prefix.includes("export")) return <BoxIcon />;
  return <SunMoonIcon />;
}