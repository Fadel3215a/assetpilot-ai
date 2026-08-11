"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  collections,
  mockActivity,
  mockAssets,
  mockComparisons,
} from "@/data";
import { calculateCuratorScore } from "@/lib/quality";
import { evaluateProductionCriteria, isQueueAsset } from "@/lib/production";
import { statusFromDecision } from "@/lib/utils";
import type {
  ActivityItem,
  Asset,
  AssetStatus,
  ChecklistRating,
  Collection,
  ComparisonDecisionType,
  ComparisonRecord,
  DecisionHistoryEntry,
  QualityCriterion,
  ReviewDecisionType,
} from "@/types";

export type ReviewAction = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

interface SubmitReviewPayload {
  action: ReviewAction;
  notes?: string;
  checklist: QualityCriterion[];
}

interface SubmitComparisonPayload {
  itemA: { assetId: string; versionId: string; label: string };
  itemB: { assetId: string; versionId: string; label: string };
  decision: ComparisonDecisionType;
  reason: string;
}

interface AssetsContextValue {
  assets: Asset[];
  collections: Collection[];
  activity: ActivityItem[];
  comparisons: ComparisonRecord[];
  getAsset: (id: string) => Asset | undefined;
  getQueueAssets: () => Asset[];
  updateCuratorChecklist: (assetId: string, criterionId: string, rating: ChecklistRating) => void;
  submitReview: (assetId: string, payload: SubmitReviewPayload) => { ok: boolean; error?: string };
  submitComparison: (payload: SubmitComparisonPayload) => { ok: boolean; error?: string };
  stats: {
    total: number;
    pendingReview: number;
    approved: number;
    needsChanges: number;
    productionReady: number;
    rejected: number;
    changeRequests: number;
  };
  getAllDecisionHistory: () => DecisionHistoryEntry[];
}

const AssetsContext = createContext<AssetsContextValue | null>(null);

const CURATOR = "Alex Chen";

function actionLabel(action: ReviewAction): string {
  switch (action) {
    case "APPROVED":
      return "Approved by curator";
    case "REJECTED":
      return "Rejected by curator";
    case "CHANGES_REQUESTED":
      return "Changes requested";
  }
}

function mapActionToStatus(action: ReviewAction): AssetStatus {
  return statusFromDecision(action);
}

export function AssetsProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>(mockAssets);
  const [activity, setActivity] = useState<ActivityItem[]>(mockActivity);
  const [comparisons, setComparisons] = useState<ComparisonRecord[]>(mockComparisons);

  const getAsset = useCallback(
    (id: string) => assets.find((a) => a.id === id),
    [assets],
  );

  const getQueueAssets = useCallback(
    () => assets.filter((a) => isQueueAsset(a.status)),
    [assets],
  );

  const updateCuratorChecklist = useCallback(
    (assetId: string, criterionId: string, rating: ChecklistRating) => {
      setAssets((prev) =>
        prev.map((asset) => {
          if (asset.id !== assetId) return asset;

          const updatedVersions = asset.versions.map((version) => {
            if (!version.isCurrent || !version.curatorChecklist) return version;
            const checklist = version.curatorChecklist.map((c) =>
              c.id === criterionId ? { ...c, rating } : c,
            );
            const curatorScore = calculateCuratorScore(checklist);
            return {
              ...version,
              curatorChecklist: checklist,
              curatorScore,
              qualityScore: { ...version.qualityScore, overall: curatorScore },
            };
          });

          const updated = { ...asset, versions: updatedVersions };
          const prod = evaluateProductionCriteria(updated);
          return {
            ...updated,
            productionReadiness: {
              score: prod.score,
              checklist: prod.items.map((i) => ({
                id: i.id,
                label: i.label,
                completed: i.completed,
              })),
              readyAt: prod.ready ? asset.productionReadiness.readyAt : undefined,
            },
          };
        }),
      );
    },
    [],
  );

  const submitReview = useCallback(
    (assetId: string, payload: SubmitReviewPayload): { ok: boolean; error?: string } => {
      const { action, notes, checklist } = payload;

      if (
        (action === "REJECTED" || action === "CHANGES_REQUESTED") &&
        (!notes || notes.trim().length === 0)
      ) {
        return {
          ok: false,
          error: "Please provide curator notes explaining this decision.",
        };
      }

      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return { ok: false, error: "Asset not found." };

      const now = new Date().toISOString();
      const previousStatus = asset.status;
      const newStatus = mapActionToStatus(action);
      const curatorScore = calculateCuratorScore(checklist);

      const historyEntry: DecisionHistoryEntry = {
        id: `dh-${Date.now()}`,
        assetId,
        timestamp: now,
        reviewer: CURATOR,
        previousStatus,
        newStatus,
        decision: action as ReviewDecisionType,
        reason: notes,
        curatorScore,
      };

      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== assetId) return a;

          const updatedVersions = a.versions.map((version) => {
            if (!version.isCurrent) return version;
            return {
              ...version,
              curatorChecklist: checklist,
              curatorScore,
              qualityScore: { ...version.qualityScore, overall: curatorScore },
              reviewDecision: {
                type: action as ReviewDecisionType,
                reviewer: CURATOR,
                decidedAt: now,
                notes,
              },
              metadata: { ...version.metadata, updatedAt: now },
            };
          });

          const updated: Asset = {
            ...a,
            status: newStatus,
            versions: updatedVersions,
            updatedAt: now,
            decisionHistory: [historyEntry, ...a.decisionHistory],
          };

          const prod = evaluateProductionCriteria(updated);
          updated.productionReadiness = {
            score: prod.score,
            checklist: prod.items.map((i) => ({
              id: i.id,
              label: i.label,
              completed: i.completed,
            })),
            readyAt: prod.ready ? now : undefined,
          };

          if (prod.ready && action === "APPROVED") {
            updated.status = "PRODUCTION_READY";
          }

          return updated;
        }),
      );

      setActivity((prev) => [
        {
          id: `act-${Date.now()}`,
          assetId,
          assetName: asset.name,
          action: actionLabel(action),
          timestamp: now,
        },
        ...prev,
      ]);

      return { ok: true };
    },
    [assets],
  );

  const submitComparison = useCallback(
    (payload: SubmitComparisonPayload): { ok: boolean; error?: string } => {
      if (!payload.reason.trim()) {
        return { ok: false, error: "Please provide a reason for this comparison decision." };
      }

      const now = new Date().toISOString();
      const record: ComparisonRecord = {
        id: `cmp-${Date.now()}`,
        timestamp: now,
        reviewer: CURATOR,
        ...payload,
      };

      setComparisons((prev) => [record, ...prev]);

      if (payload.decision === "PREFER_A" || payload.decision === "PREFER_B") {
        const preferredId =
          payload.decision === "PREFER_A" ? payload.itemA.assetId : payload.itemB.assetId;
        const rejectedId =
          payload.decision === "PREFER_A" ? payload.itemB.assetId : payload.itemA.assetId;

        setAssets((prev) =>
          prev.map((a) => {
            if (a.id === preferredId) {
              return { ...a, status: "APPROVED", updatedAt: now };
            }
            if (a.id === rejectedId && payload.decision !== "KEEP_BOTH") {
              return { ...a, status: "REJECTED", updatedAt: now };
            }
            return a;
          }),
        );
      }

      if (payload.decision === "REJECT_BOTH") {
        setAssets((prev) =>
          prev.map((a) => {
            if (a.id === payload.itemA.assetId || a.id === payload.itemB.assetId) {
              return { ...a, status: "REJECTED", updatedAt: now };
            }
            return a;
          }),
        );
      }

      setActivity((prev) => [
        {
          id: `act-${Date.now()}`,
          assetId: payload.itemA.assetId,
          assetName: payload.itemA.label,
          action: `Comparison: ${payload.decision.replace(/_/g, " ").toLowerCase()}`,
          timestamp: now,
        },
        ...prev,
      ]);

      return { ok: true };
    },
    [],
  );

  const getAllDecisionHistory = useCallback(() => {
    return assets
      .flatMap((a) => a.decisionHistory)
      .sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [assets]);

  const stats = useMemo(
    () => ({
      total: assets.length,
      pendingReview: assets.filter((a) => isQueueAsset(a.status)).length,
      approved: assets.filter((a) => a.status === "APPROVED").length,
      needsChanges: assets.filter((a) => a.status === "CHANGES_REQUESTED").length,
      productionReady: assets.filter((a) => a.status === "PRODUCTION_READY").length,
      rejected: assets.filter((a) => a.status === "REJECTED").length,
      changeRequests: assets.filter((a) => a.status === "CHANGES_REQUESTED").length,
    }),
    [assets],
  );

  const value = useMemo(
    () => ({
      assets,
      collections,
      activity,
      comparisons,
      getAsset,
      getQueueAssets,
      updateCuratorChecklist,
      submitReview,
      submitComparison,
      stats,
      getAllDecisionHistory,
    }),
    [
      assets,
      activity,
      comparisons,
      getAsset,
      getQueueAssets,
      updateCuratorChecklist,
      submitReview,
      submitComparison,
      stats,
      getAllDecisionHistory,
    ],
  );

  return (
    <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>
  );
}

export function useAssets() {
  const context = useContext(AssetsContext);
  if (!context) {
    throw new Error("useAssets must be used within AssetsProvider");
  }
  return context;
}
