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
  AIAssistanceStats,
  Asset,
  AssetAISessionState,
  AssetStatus,
  ChecklistRating,
  Collection,
  ComparisonDecisionType,
  ComparisonRecord,
  CuratorFeedbackEntry,
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
  feedback: CuratorFeedbackEntry[];
  getAsset: (id: string) => Asset | undefined;
  getQueueAssets: () => Asset[];
  getAISession: (assetId: string) => AssetAISessionState;
  markAIAssistedReview: (assetId: string) => void;
  updateCuratorChecklist: (assetId: string, criterionId: string, rating: ChecklistRating) => void;
  submitReview: (assetId: string, payload: SubmitReviewPayload) => { ok: boolean; error?: string };
  submitComparison: (payload: SubmitComparisonPayload) => { ok: boolean; error?: string };
  acceptTagSuggestion: (assetId: string, tagId: string) => void;
  editTagSuggestion: (assetId: string, tagId: string, newTag: string) => void;
  dismissTagSuggestion: (assetId: string, tagId: string) => void;
  acceptCollectionSuggestion: (assetId: string, collectionId: string) => void;
  dismissObservation: (assetId: string, observationId: string) => void;
  acceptObservation: (assetId: string, observationId: string) => void;
  getAssetFeedback: (assetId: string) => CuratorFeedbackEntry[];
  stats: {
    total: number;
    pendingReview: number;
    approved: number;
    needsChanges: number;
    productionReady: number;
    rejected: number;
    changeRequests: number;
  };
  aiStats: AIAssistanceStats;
  getAllDecisionHistory: () => DecisionHistoryEntry[];
}

const AssetsContext = createContext<AssetsContextValue | null>(null);

const CURATOR = "Alex Chen";

const defaultSession = (): AssetAISessionState => ({
  dismissedTagIds: [],
  dismissedObservationIds: [],
  aiAssistedReview: false,
});

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
  const [feedback, setFeedback] = useState<CuratorFeedbackEntry[]>([]);
  const [aiSessions, setAiSessions] = useState<Record<string, AssetAISessionState>>({});

  const addActivity = useCallback(
    (item: Omit<ActivityItem, "id">) => {
      setActivity((prev) => [
        { ...item, id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
        ...prev,
      ]);
    },
    [],
  );

  const addFeedback = useCallback(
    (entry: Omit<CuratorFeedbackEntry, "id" | "timestamp">) => {
      const full: CuratorFeedbackEntry = {
        ...entry,
        id: `fb-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      setFeedback((prev) => [full, ...prev]);
      return full;
    },
    [],
  );

  const getAsset = useCallback(
    (id: string) => assets.find((a) => a.id === id),
    [assets],
  );

  const getAISession = useCallback(
    (assetId: string) => aiSessions[assetId] ?? defaultSession(),
    [aiSessions],
  );

  const markAIAssistedReview = useCallback((assetId: string) => {
    setAiSessions((prev) => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] ?? defaultSession()),
        aiAssistedReview: true,
      },
    }));
  }, []);

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

  const acceptTagSuggestion = useCallback(
    (assetId: string, tagId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const suggestion = asset.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return;

      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId && !a.tags.includes(suggestion.tag)
            ? { ...a, tags: [...a.tags, suggestion.tag] }
            : a,
        ),
      );

      setAiSessions((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? defaultSession()),
          dismissedTagIds: [...(prev[assetId]?.dismissedTagIds ?? []), tagId],
        },
      }));

      addFeedback({
        assetId,
        suggestionType: "tag",
        suggestion: suggestion.tag,
        curatorAction: "accepted",
        finalValue: suggestion.tag,
      });

      addActivity({
        assetId,
        assetName: asset.name,
        action: `Curator accepted tag: "${suggestion.tag}"`,
        timestamp: new Date().toISOString(),
        source: "curator",
      });
    },
    [assets, addActivity, addFeedback],
  );

  const editTagSuggestion = useCallback(
    (assetId: string, tagId: string, newTag: string) => {
      const trimmed = newTag.trim();
      if (!trimmed) return;
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const suggestion = asset.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return;

      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId && !a.tags.includes(trimmed)
            ? { ...a, tags: [...a.tags, trimmed] }
            : a,
        ),
      );

      setAiSessions((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? defaultSession()),
          dismissedTagIds: [...(prev[assetId]?.dismissedTagIds ?? []), tagId],
        },
      }));

      addFeedback({
        assetId,
        suggestionType: "tag",
        suggestion: suggestion.tag,
        curatorAction: "edited",
        finalValue: trimmed,
      });

      addActivity({
        assetId,
        assetName: asset.name,
        action: `Curator edited tag: "${suggestion.tag}" → "${trimmed}"`,
        timestamp: new Date().toISOString(),
        source: "curator",
      });
    },
    [assets, addActivity, addFeedback],
  );

  const dismissTagSuggestion = useCallback(
    (assetId: string, tagId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const suggestion = asset.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return;

      setAiSessions((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? defaultSession()),
          dismissedTagIds: [...(prev[assetId]?.dismissedTagIds ?? []), tagId],
        },
      }));

      addFeedback({
        assetId,
        suggestionType: "tag",
        suggestion: suggestion.tag,
        curatorAction: "dismissed",
      });

      addActivity({
        assetId,
        assetName: asset.name,
        action: `Curator dismissed tag: "${suggestion.tag}"`,
        timestamp: new Date().toISOString(),
        source: "curator",
      });
    },
    [assets, addActivity, addFeedback],
  );

  const acceptCollectionSuggestion = useCallback(
    (assetId: string, collectionId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      const collection = collections.find((c) => c.id === collectionId);
      if (!asset || !collection) return;

      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, collectionId } : a)),
      );

      addFeedback({
        assetId,
        suggestionType: "collection",
        suggestion: asset.aiAnalysis.suggestedCollectionId,
        curatorAction: "accepted",
        finalValue: collectionId,
      });

      addActivity({
        assetId,
        assetName: asset.name,
        action: `Curator accepted collection: "${collection.name}"`,
        timestamp: new Date().toISOString(),
        source: "curator",
      });
    },
    [assets, addActivity, addFeedback],
  );

  const dismissObservation = useCallback(
    (assetId: string, observationId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const obs = asset.aiAnalysis.observations.find((o) => o.id === observationId);
      if (!obs) return;

      setAiSessions((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? defaultSession()),
          dismissedObservationIds: [
            ...(prev[assetId]?.dismissedObservationIds ?? []),
            observationId,
          ],
        },
      }));

      addFeedback({
        assetId,
        suggestionType: "observation",
        suggestion: obs.text,
        curatorAction: "dismissed",
      });

      addActivity({
        assetId,
        assetName: asset.name,
        action: `Curator dismissed observation: "${obs.text}"`,
        timestamp: new Date().toISOString(),
        source: "curator",
      });
    },
    [assets, addActivity, addFeedback],
  );

  const acceptObservation = useCallback(
    (assetId: string, observationId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const obs = asset.aiAnalysis.observations.find((o) => o.id === observationId);
      if (!obs) return;

      setAiSessions((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? defaultSession()),
          dismissedObservationIds: [
            ...(prev[assetId]?.dismissedObservationIds ?? []),
            observationId,
          ],
        },
      }));

      addFeedback({
        assetId,
        suggestionType: "observation",
        suggestion: obs.text,
        curatorAction: "accepted",
        finalValue: obs.text,
      });

      addActivity({
        assetId,
        assetName: asset.name,
        action: `Curator accepted observation: "${obs.text}"`,
        timestamp: new Date().toISOString(),
        source: "curator",
      });
    },
    [assets, addActivity, addFeedback],
  );

  const getAssetFeedback = useCallback(
    (assetId: string) => feedback.filter((f) => f.assetId === assetId),
    [feedback],
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

      addActivity({
        assetId,
        assetName: asset.name,
        action: actionLabel(action),
        timestamp: now,
        source: "curator",
      });

      return { ok: true };
    },
    [assets, addActivity],
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
            if (a.id === rejectedId) {
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

      addActivity({
        assetId: payload.itemA.assetId,
        assetName: payload.itemA.label,
        action: `Curator comparison: ${payload.decision.replace(/_/g, " ").toLowerCase()}`,
        timestamp: now,
        source: "curator",
      });

      return { ok: true };
    },
    [addActivity],
  );

  const getAllDecisionHistory = useCallback(() => {
    return assets
      .flatMap((a) => a.decisionHistory)
      .sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [assets]);

  const aiStats = useMemo((): AIAssistanceStats => {
    const accepted = feedback.filter((f) => f.curatorAction === "accepted").length;
    const edited = feedback.filter((f) => f.curatorAction === "edited").length;
    const dismissed = feedback.filter((f) => f.curatorAction === "dismissed").length;
    const aiAssistedReviews = Object.values(aiSessions).filter((s) => s.aiAssistedReview).length;

    const suggestionsTotal = assets.reduce((sum, a) => {
      const session = aiSessions[a.id] ?? defaultSession();
      const activeTags = a.aiAnalysis.suggestedTags.filter(
        (t) => !session.dismissedTagIds.includes(t.id),
      );
      const activeObs = a.aiAnalysis.observations.filter(
        (o) => !session.dismissedObservationIds.includes(o.id),
      );
      return sum + activeTags.length + activeObs.length + 1;
    }, 0);

    return {
      suggestionsTotal,
      accepted,
      edited,
      dismissed,
      aiAssistedReviews,
    };
  }, [assets, feedback, aiSessions]);

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
      feedback,
      getAsset,
      getQueueAssets,
      getAISession,
      markAIAssistedReview,
      updateCuratorChecklist,
      submitReview,
      submitComparison,
      acceptTagSuggestion,
      editTagSuggestion,
      dismissTagSuggestion,
      acceptCollectionSuggestion,
      dismissObservation,
      acceptObservation,
      getAssetFeedback,
      stats,
      aiStats,
      getAllDecisionHistory,
    }),
    [
      assets,
      activity,
      comparisons,
      feedback,
      getAsset,
      getQueueAssets,
      getAISession,
      markAIAssistedReview,
      updateCuratorChecklist,
      submitReview,
      submitComparison,
      acceptTagSuggestion,
      editTagSuggestion,
      dismissTagSuggestion,
      acceptCollectionSuggestion,
      dismissObservation,
      acceptObservation,
      getAssetFeedback,
      stats,
      aiStats,
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
