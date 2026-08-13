"use client";

import { useEffect, useRef } from "react";
import { getAIAnalysisProvider } from "@/lib/ai";
import { evaluateProductionCriteria } from "@/lib/production";
import type { Asset, Collection } from "@/types";

export function useObjectUrlRegistry() {
  const urlsRef = useRef<Set<string>>(new Set());

  const register = (url: string) => {
    if (url.startsWith("blob:")) urlsRef.current.add(url);
    return url;
  };

  const revoke = (url: string) => {
    if (urlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(url);
    }
  };

  const revokeAll = () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  };

  useEffect(() => () => revokeAll(), []);

  return { register, revoke, revokeAll };
}

export function applyAIAndProduction(asset: Asset, collections: Collection[]): Asset {
  const updated = { ...asset };
  updated.aiAnalysis = getAIAnalysisProvider().analyze(updated, collections);
  const prod = evaluateProductionCriteria(updated);
  updated.productionReadiness = {
    score: prod.score,
    checklist: prod.items.map((i) => ({
      id: i.id,
      label: i.label,
      completed: i.completed,
    })),
    readyAt: prod.ready ? updated.productionReadiness.readyAt ?? updated.updatedAt : undefined,
  };
  return updated;
}
