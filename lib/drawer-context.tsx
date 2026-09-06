"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAssets } from "@/lib/assets-context";

interface DrawerContextValue {
  isOpen: boolean;
  currentAssetId: string | null;
  /** Persistent index of the "active" asset focus (survives open/close). */
  activeIndex: number;
  /** Id of the asset under active focus (derived from activeIndex). */
  activeAssetId: string | null;
  /** Opens the drawer for the given asset, or the active-asset when omitted. */
  openDrawer: (assetId?: string) => void;
  closeDrawer: () => void;
  /** Moves the active focus (and the open drawer) by one, wrapping around. */
  moveFocus: (delta: 1 | -1) => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

/**
 * Stage 2.1 — Asset detail drawer state.
 *
 * Holds the opened asset id and a persistent active-focus index over the
 * current inventory order. The card grid opens the slide-over; the global
 * hotkey engine (Stage 3.1) navigates active focus with J/K at any time, and
 * Space toggles the drawer for whatever asset is under focus.
 */
export function DrawerProvider({ children }: { children: ReactNode }) {
  const { assets } = useAssets();
  const [currentAssetId, setCurrentAssetId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapIndex = useCallback(
    (index: number) => (assets.length === 0 ? 0 : (index + assets.length) % assets.length),
    [assets.length],
  );

  const openDrawer = useCallback(
    (assetId?: string) => {
      const targetId = assetId ?? assets[wrapIndex(activeIndex)]?.id ?? null;
      if (!targetId) return;
      const index = assets.findIndex((a) => a.id === targetId);
      if (index >= 0) setActiveIndex(index);
      setCurrentAssetId(targetId);
    },
    [assets, activeIndex, wrapIndex],
  );

  const closeDrawer = useCallback(() => {
    setCurrentAssetId(null);
  }, []);

  const moveFocus = useCallback(
    (delta: 1 | -1) => {
      if (assets.length === 0) return;
      const baseAssetId = currentAssetId ?? assets[wrapIndex(activeIndex)]?.id ?? null;
      const baseIndex =
        baseAssetId === null ? activeIndex : Math.max(0, assets.findIndex((a) => a.id === baseAssetId));
      const nextIndex = wrapIndex(baseIndex + delta);
      setActiveIndex(nextIndex);
      if (currentAssetId !== null) setCurrentAssetId(assets[nextIndex].id);
    },
    [assets, currentAssetId, activeIndex, wrapIndex],
  );

  const activeAssetId = assets[wrapIndex(activeIndex)]?.id ?? null;

  const value = useMemo<DrawerContextValue>(
    () => ({
      isOpen: currentAssetId !== null,
      currentAssetId,
      activeIndex,
      activeAssetId,
      openDrawer,
      closeDrawer,
      moveFocus,
    }),
    [currentAssetId, activeIndex, activeAssetId, openDrawer, closeDrawer, moveFocus],
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return context;
}