"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDrawer } from "@/lib/drawer-context";
import { useAssets } from "@/lib/assets-context";
import { useBackgroundActions } from "@/lib/use-background-actions";

interface HotkeysContextValue {
  legendOpen: boolean;
  openLegend: () => void;
  closeLegend: () => void;
}

const HotkeysContext = createContext<HotkeysContextValue | null>(null);

/**
 * Stage 3.1 — Global keyboard hotkey engine.
 *
 * Listens on window for shortcuts and dispatches when no input/textarea (or a
 * contenteditable) is focused. Each handler does its work in its own event
 * callback (never synchronously in an effect body) to satisfy the React Compiler
 * lint rules.
 *
 *   Space      toggle the slide-over drawer for the active asset
 *   J / ↓      move active-asset focus forward
 *   K / ↑      move active-asset focus backward
 *   E          trigger inventory ZIP export
 *   R          trigger vector re-index
 *   ?          toggle the hotkeys cheat-sheet modal
 */
export function HotkeysProvider({ children }: { children: ReactNode }) {
  const { openDrawer, closeDrawer, isOpen, moveFocus } = useDrawer();
  const { assets } = useAssets();
  const { dispatchExport, dispatchReindex } = useBackgroundActions();
  const [legendOpen, setLegendOpen] = useState(false);
  const legendOpenRef = useRef(false);

  const setLegend = useCallback((next: boolean) => {
    legendOpenRef.current = next;
    setLegendOpen(next);
  }, []);

  const openLegend = useCallback(() => setLegend(true), [setLegend]);
  const closeLegend = useCallback(() => setLegend(false), [setLegend]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (legendOpenRef.current) {
        if (event.key === "Escape" || event.key === "?") {
          event.preventDefault();
          setLegend(false);
        }
        return;
      }
      if (isTypingTarget(event.target)) return;

      const key = event.key;
      const withModifier = event.ctrlKey || event.metaKey || event.altKey;

      // Toggle cheat sheet (? ).
      if (key === "?") {
        event.preventDefault();
        setLegend(true);
        return;
      }

      // Skip the rest when any modifier is held (preserve browser/OS combos).
      if (withModifier) return;

      switch (key) {
        case " ": {
          event.preventDefault();
          if (isOpen) closeDrawer();
          else openDrawer();
          break;
        }
        case "j":
        case "J":
        case "ArrowDown":
        case "ArrowRight": {
          event.preventDefault();
          moveFocus(1);
          break;
        }
        case "k":
        case "K":
        case "ArrowUp":
        case "ArrowLeft": {
          event.preventDefault();
          moveFocus(-1);
          break;
        }
        case "e":
        case "E": {
          if (assets.length === 0) break;
          event.preventDefault();
          void dispatchExport(assets.map((a) => a.id));
          break;
        }
        case "r":
        case "R": {
          event.preventDefault();
          void dispatchReindex();
          break;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, openDrawer, closeDrawer, moveFocus, assets, dispatchExport, dispatchReindex, setLegend]);

  const value = useMemo<HotkeysContextValue>(
    () => ({ legendOpen, openLegend, closeLegend }),
    [legendOpen, openLegend, closeLegend],
  );

  return (
    <HotkeysContext.Provider value={value}>
      {children}
    </HotkeysContext.Provider>
  );
}

export function useHotkeys(): HotkeysContextValue {
  const context = useContext(HotkeysContext);
  if (!context) {
    throw new Error("useHotkeys must be used within a HotkeysProvider");
  }
  return context;
}