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
  openDrawer: (assetId: string) => void;
  closeDrawer: () => void;
  nextAsset: () => void;
  prevAsset: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

/**
 * Stage 2.1 — Asset detail drawer state.
 *
 * Holds the opened asset id and exposes open/close plus index-based
 * next/prev navigation over the current inventory order, so the card grid can
 * open the slide-over and let users flip between assets with the keyboard.
 */
export function DrawerProvider({ children }: { children: ReactNode }) {
  const { assets } = useAssets();
  const [currentAssetId, setCurrentAssetId] = useState<string | null>(null);

  const openDrawer = useCallback((assetId: string) => {
    setCurrentAssetId(assetId);
  }, []);

  const closeDrawer = useCallback(() => {
    setCurrentAssetId(null);
  }, []);

  const navigate = useCallback(
    (delta: 1 | -1) => {
      if (currentAssetId === null || assets.length === 0) return;
      const index = assets.findIndex((a) => a.id === currentAssetId);
      if (index === -1) return;
      const next = (index + delta + assets.length) % assets.length;
      setCurrentAssetId(assets[next].id);
    },
    [assets, currentAssetId],
  );

  const nextAsset = useCallback(() => navigate(1), [navigate]);
  const prevAsset = useCallback(() => navigate(-1), [navigate]);

  const value = useMemo<DrawerContextValue>(
    () => ({
      isOpen: currentAssetId !== null,
      currentAssetId,
      openDrawer,
      closeDrawer,
      nextAsset,
      prevAsset,
    }),
    [currentAssetId, openDrawer, closeDrawer, nextAsset, prevAsset],
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