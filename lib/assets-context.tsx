"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  acceptCollectionSuggestionAction,
  acceptObservationAction,
  acceptTagSuggestionAction,
  bulkAddTagAction,
  bulkMoveToCollectionAction,
  bulkRemoveTagAction,
  createAssetVersionAction,
  deleteVersionAction,
  dismissObservationAction,
  dismissTagSuggestionAction,
  editTagSuggestionAction,
  fetchFeedAction,
  ignoreDuplicateAction,
  markAIAssistedReviewAction,
  promoteVersionAction,
  resetDemoAction,
  submitComparisonAction,
  submitReviewAction,
  updateAssetMetadataAction,
  updateCuratorChecklistAction,
  uploadAssetAction,
  searchAssetsAction,
} from "@/lib/server/actions";
import { applyAIAndProduction, useObjectUrlRegistry } from "@/lib/object-url-registry";
import { buildAssetTimeline } from "@/lib/asset-timeline";
import { computeAssetHealth } from "@/lib/asset-health";
import {
  countPossibleDuplicates,
  findDuplicateCandidates,
  getAssetsWithMetadataIssues,
} from "@/lib/duplicate-detection";
import { extractFileMetadata, inferUploadCategory, mapCategoryToAssetType } from "@/lib/file-metadata";
import { findRelatedAssets } from "@/lib/related-assets";
import { buildNewVersion, buildUploadedAsset } from "@/lib/upload-asset";
import { calculateCuratorScore } from "@/lib/quality";
import { evaluateProductionCriteria, isQueueAsset } from "@/lib/production";
import { statusFromDecision } from "@/lib/utils";
import type {
  ActivityItem,
  AIAssistanceStats,
  Asset,
  AssetAISessionState,
  AssetHealth,
  AssetStatus,
  AssetTimelineEntry,
  ChecklistRating,
  Collection,
  ComparisonDecisionType,
  ComparisonRecord,
  CuratorFeedbackEntry,
  DecisionHistoryEntry,
  DuplicateCandidate,
  MetadataEditPayload,
  QualityCriterion,
  RelatedAsset,
  ReviewDecisionType,
  AssetSearchHit,
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

export interface AssetsProviderInitialState {
  assets: Asset[];
  collections: Collection[];
  activity: ActivityItem[];
  comparisons: ComparisonRecord[];
  feedback: CuratorFeedbackEntry[];
  ignoredDuplicateIds: string[];
}

interface StateSnapshot {
  assets: Asset[];
  collections: Collection[];
  activity: ActivityItem[];
  comparisons: ComparisonRecord[];
  feedback: CuratorFeedbackEntry[];
  aiSessions: Record<string, AssetAISessionState>;
  ignoredDuplicates: Set<string>;
}

type ServerActionResult = {
  ok: boolean;
  error?: string;
  asset?: Asset;
  assets?: Asset[];
};

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
  uploadAsset: (file: File, collectionId?: string) => Promise<{ ok: boolean; error?: string; assetId?: string }>;
  updateAssetMetadata: (assetId: string, payload: MetadataEditPayload) => { ok: boolean; error?: string };
  createAssetVersion: (
    assetId: string,
    file: File | null,
    label: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  promoteVersion: (assetId: string, versionId: string) => void;
  deleteVersion: (assetId: string, versionId: string) => void;
  ignoreDuplicate: (duplicateId: string) => void;
  getDuplicateCandidates: (assetId: string) => DuplicateCandidate[];
  getRelatedAssets: (assetId: string) => RelatedAsset[];
  getAssetHealth: (assetId: string) => AssetHealth | null;
  getAssetTimeline: (assetId: string) => AssetTimelineEntry[];
  searchAssets: (
    query: string,
    limit?: number,
  ) => Promise<{ ok: boolean; error?: string; assets?: Asset[]; hits?: AssetSearchHit[] }>;
  bulkAddTag: (assetIds: string[], tag: string) => void;
  bulkRemoveTag: (assetIds: string[], tag: string) => void;
  bulkMoveToCollection: (assetIds: string[], collectionId: string) => void;
  stats: {
    total: number;
    pendingReview: number;
    approved: number;
    needsChanges: number;
    productionReady: number;
    rejected: number;
    changeRequests: number;
    metadataIssues: number;
    possibleDuplicates: number;
  };
  aiStats: AIAssistanceStats;
  getAllDecisionHistory: () => DecisionHistoryEntry[];
  resetDemo: () => void;
  lastError: string | null;
  dismissError: () => void;
}

const AssetsContext = createContext<AssetsContextValue | null>(null);

const CURATOR = "Alex Chen";

const defaultSession = (): AssetAISessionState => ({
  dismissedTagIds: [],
  dismissedObservationIds: [],
  acceptedTagIds: [],
  acceptedObservationIds: [],
  collectionOverrides: [],
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

function computeChecklistUpdate(asset: Asset, criterionId: string, rating: ChecklistRating): Asset {
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
}

export function AssetsProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState: AssetsProviderInitialState;
}) {
  const { register: registerObjectUrl, revokeAll: revokeAllObjectUrls } = useObjectUrlRegistry();
  const [assets, setAssets] = useState<Asset[]>(initialState.assets);
  const [collections, setCollections] = useState<Collection[]>(initialState.collections);
  const [activity, setActivity] = useState<ActivityItem[]>(initialState.activity);
  const [comparisons, setComparisons] = useState<ComparisonRecord[]>(initialState.comparisons);
  const [feedback, setFeedback] = useState<CuratorFeedbackEntry[]>(initialState.feedback);
  const [aiSessions, setAiSessions] = useState<Record<string, AssetAISessionState>>({});
  const [ignoredDuplicates, setIgnoredDuplicates] = useState<Set<string>>(
    new Set(initialState.ignoredDuplicateIds),
  );
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastError) return;
    const timer = setTimeout(() => setLastError(null), 6000);
    return () => clearTimeout(timer);
  }, [lastError]);

  const fail = useCallback((message: string) => {
    console.error(`[AssetPilot] ${message}`);
    setLastError(message);
  }, []);

  const dismissError = useCallback(() => setLastError(null), []);

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

  const takeSnapshot = useCallback(
    (): StateSnapshot => ({
      assets,
      collections,
      activity,
      comparisons,
      feedback,
      aiSessions,
      ignoredDuplicates,
    }),
    [assets, collections, activity, comparisons, feedback, aiSessions, ignoredDuplicates],
  );

  const restoreSnapshot = useCallback((snapshot: StateSnapshot) => {
    setAssets(snapshot.assets);
    setCollections(snapshot.collections);
    setActivity(snapshot.activity);
    setComparisons(snapshot.comparisons);
    setFeedback(snapshot.feedback);
    setAiSessions(snapshot.aiSessions);
    setIgnoredDuplicates(snapshot.ignoredDuplicates);
  }, []);

  const applyCanonicalAssets = useCallback((incoming: Asset[]) => {
    if (incoming.length === 0) return;
    const byId = new Map(incoming.map((a) => [a.id, a]));
    setAssets((prev) => prev.map((a) => byId.get(a.id) ?? a));
  }, []);

  const reconcileFeed = useCallback(() => {
    void fetchFeedAction()
      .then((res) => {
        if (res.ok && res.activity && res.comparisons && res.feedback) {
          setActivity(res.activity);
          setComparisons(res.comparisons);
          setFeedback(res.feedback);
        }
      })
      .catch(() => {});
  }, []);

  const runAction = useCallback(
    (snapshot: StateSnapshot, invoke: () => Promise<ServerActionResult>, fallbackError: string) => {
      void invoke()
        .then((res) => {
          if (!res.ok) {
            restoreSnapshot(snapshot);
            fail(res.error ?? fallbackError);
            return;
          }
          const canonical: Asset[] = [];
          if (res.asset) canonical.push(res.asset);
          if (res.assets) canonical.push(...res.assets);
          applyCanonicalAssets(canonical);
          reconcileFeed();
        })
        .catch(() => {
          restoreSnapshot(snapshot);
          fail(fallbackError);
        });
    },
    [restoreSnapshot, applyCanonicalAssets, reconcileFeed, fail],
  );

  const getAsset = useCallback(
    (id: string) => assets.find((a) => a.id === id),
    [assets],
  );

  const getAISession = useCallback(
    (assetId: string) => aiSessions[assetId] ?? defaultSession(),
    [aiSessions],
  );

  const markAIAssistedReview = useCallback(
    (assetId: string) => {
      const prevSessions = aiSessions;
      setAiSessions((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? defaultSession()),
          aiAssistedReview: true,
        },
      }));
      void markAIAssistedReviewAction(assetId)
        .then((res) => {
          if (!res.ok) {
            setAiSessions(prevSessions);
            fail(res.error ?? "Could not save AI-assisted review flag.");
          }
        })
        .catch(() => {
          setAiSessions(prevSessions);
          fail("Could not save AI-assisted review flag.");
        });
    },
    [aiSessions, fail],
  );

  const getQueueAssets = useCallback(
    () => assets.filter((a) => isQueueAsset(a.status)),
    [assets],
  );

  const updateCuratorChecklist = useCallback(
    (assetId: string, criterionId: string, rating: ChecklistRating) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      const optimistic = computeChecklistUpdate(asset, criterionId, rating);
      const snapshot = takeSnapshot();
      setAssets((prev) => prev.map((a) => (a.id === assetId ? optimistic : a)));

      runAction(
        snapshot,
        () => updateCuratorChecklistAction(assetId, criterionId, rating),
        "Could not save checklist rating.",
      );
    },
    [assets, runAction, takeSnapshot],
  );

  const acceptTagSuggestion = useCallback(
    (assetId: string, tagId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const suggestion = asset.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return;

      const snapshot = takeSnapshot();

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
          acceptedTagIds: [...(prev[assetId]?.acceptedTagIds ?? []), tagId],
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

      runAction(
        snapshot,
        () => acceptTagSuggestionAction(assetId, tagId),
        "Could not accept tag suggestion.",
      );
    },
    [assets, addActivity, addFeedback, runAction, takeSnapshot],
  );

  const editTagSuggestion = useCallback(
    (assetId: string, tagId: string, newTag: string) => {
      const trimmed = newTag.trim();
      if (!trimmed) return;
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const suggestion = asset.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return;

      const snapshot = takeSnapshot();

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
          acceptedTagIds: [...(prev[assetId]?.acceptedTagIds ?? []), tagId],
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

      runAction(
        snapshot,
        () => editTagSuggestionAction(assetId, tagId, trimmed),
        "Could not save edited tag.",
      );
    },
    [assets, addActivity, addFeedback, runAction, takeSnapshot],
  );

  const dismissTagSuggestion = useCallback(
    (assetId: string, tagId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const suggestion = asset.aiAnalysis.suggestedTags.find((t) => t.id === tagId);
      if (!suggestion) return;

      const snapshot = takeSnapshot();

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

      runAction(
        snapshot,
        () => dismissTagSuggestionAction(assetId, tagId),
        "Could not dismiss tag suggestion.",
      );
    },
    [assets, addActivity, addFeedback, runAction, takeSnapshot],
  );

  const acceptCollectionSuggestion = useCallback(
    (assetId: string, collectionId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      const collection = collections.find((c) => c.id === collectionId);
      if (!asset || !collection) return;

      const snapshot = takeSnapshot();

      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, collectionId } : a)),
      );

      setAiSessions((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? defaultSession()),
          collectionOverrides: [
            ...(prev[assetId]?.collectionOverrides ?? []),
            collectionId,
          ],
        },
      }));

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

      runAction(
        snapshot,
        () => acceptCollectionSuggestionAction(assetId, collectionId),
        "Could not apply collection suggestion.",
      );
    },
    [assets, collections, addActivity, addFeedback, runAction, takeSnapshot],
  );

  const dismissObservation = useCallback(
    (assetId: string, observationId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const obs = asset.aiAnalysis.observations.find((o) => o.id === observationId);
      if (!obs) return;

      const snapshot = takeSnapshot();

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

      runAction(
        snapshot,
        () => dismissObservationAction(assetId, observationId),
        "Could not dismiss observation.",
      );
    },
    [assets, addActivity, addFeedback, runAction, takeSnapshot],
  );

  const acceptObservation = useCallback(
    (assetId: string, observationId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const obs = asset.aiAnalysis.observations.find((o) => o.id === observationId);
      if (!obs) return;

      const snapshot = takeSnapshot();

      setAiSessions((prev) => ({
        ...prev,
        [assetId]: {
          ...(prev[assetId] ?? defaultSession()),
          acceptedObservationIds: [
            ...(prev[assetId]?.acceptedObservationIds ?? []),
            observationId,
          ],
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

      runAction(
        snapshot,
        () => acceptObservationAction(assetId, observationId),
        "Could not accept observation.",
      );
    },
    [assets, addActivity, addFeedback, runAction, takeSnapshot],
  );

  const getAssetFeedback = useCallback(
    (assetId: string) => feedback.filter((f) => f.assetId === assetId),
    [feedback],
  );

  const uploadAsset = useCallback(
    async (file: File, collectionId = "col-archive-draft") => {
      let objectUrl: string | null = null;
      let optimisticId: string | null = null;
      const snapshot = takeSnapshot();

      try {
        const extracted = await extractFileMetadata(file);
        const category = inferUploadCategory(file);
        const type = mapCategoryToAssetType(category);
        objectUrl = registerObjectUrl(URL.createObjectURL(file));
        optimisticId = `asset-upload-${Date.now()}`;
        let optimistic = buildUploadedAsset(extracted, type, objectUrl, collectionId, collections, {
          id: optimisticId,
          isSessionUpload: false,
        });
        optimistic = applyAIAndProduction(optimistic, collections);

        setAssets((prev) => [optimistic, ...prev]);

        addActivity({
          assetId: optimistic.id,
          assetName: optimistic.name,
          action: "Asset uploaded",
          timestamp: new Date().toISOString(),
          source: "curator",
        });

        addActivity({
          assetId: optimistic.id,
          assetName: optimistic.name,
          action: "AI analysis generated for uploaded asset",
          timestamp: new Date().toISOString(),
          source: "ai",
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("collectionId", collectionId);
        formData.append("extractedMetadata", JSON.stringify(extracted));

        const res = await uploadAssetAction(formData);
        if (!res.ok || !res.asset) {
          restoreSnapshot(snapshot);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return { ok: false as const, error: res.error ?? "Could not process uploaded file." };
        }

        const canonical = res.asset;
        setAssets((prev) => [
          canonical,
          ...prev.filter((a) => a.id !== optimisticId && a.id !== canonical.id),
        ]);
        reconcileFeed();

        return { ok: true as const, assetId: canonical.id };
      } catch {
        restoreSnapshot(snapshot);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return { ok: false as const, error: "Could not process uploaded file." };
      }
    },
    [collections, registerObjectUrl, addActivity, restoreSnapshot, reconcileFeed, takeSnapshot],
  );

  const searchAssets = useCallback(
    async (query: string, limit?: number) => {
      const trimmed = query.trim();
      if (!trimmed) return { ok: true as const, assets: [] as Asset[], hits: [] as AssetSearchHit[] };
      try {
        const res = await searchAssetsAction(trimmed, limit ?? 12);
        if (!res.ok || !res.assets) {
          return { ok: false as const, error: res.error ?? "Could not search assets." };
        }
        return { ok: true as const, assets: res.assets, hits: res.hits };
      } catch {
        return { ok: false as const, error: "Could not search assets." };
      }
    },
    [],
  );

  const updateAssetMetadata = useCallback(
    (assetId: string, payload: MetadataEditPayload) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return { ok: false, error: "Asset not found." };

      const now = new Date().toISOString();
      const snapshot = takeSnapshot();

      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== assetId) return a;
          const versions = a.versions.map((v) =>
            v.isCurrent
              ? {
                  ...v,
                  metadata: {
                    ...v.metadata,
                    title: payload.name,
                    description: payload.description,
                    updatedAt: now,
                  },
                }
              : v,
          );
          const updated = applyAIAndProduction(
            {
              ...a,
              name: payload.name,
              tags: payload.tags,
              collectionId: payload.collectionId,
              usageNotes: payload.usageNotes,
              versions,
              updatedAt: now,
            },
            collections,
          );
          return updated;
        }),
      );

      addActivity({
        assetId,
        assetName: payload.name,
        action: "Metadata updated",
        timestamp: now,
        source: "curator",
      });

      runAction(
        snapshot,
        () => updateAssetMetadataAction(assetId, payload),
        "Could not save metadata changes.",
      );

      return { ok: true };
    },
    [assets, collections, addActivity, runAction, takeSnapshot],
  );

  const createAssetVersion = useCallback(
    async (assetId: string, file: File | null, label: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return { ok: false as const, error: "Asset not found." };

      let objectUrl: string | null = null;
      const snapshot = takeSnapshot();

      try {
        let extracted = null;
        if (file) {
          extracted = await extractFileMetadata(file);
          objectUrl = registerObjectUrl(URL.createObjectURL(file));
        }

        let optimistic = buildNewVersion(asset, objectUrl, extracted, label);
        optimistic = applyAIAndProduction(optimistic, collections);

        setAssets((prev) => prev.map((a) => (a.id === assetId ? optimistic : a)));

        addActivity({
          assetId,
          assetName: asset.name,
          action: `Version created: ${label}`,
          timestamp: new Date().toISOString(),
          source: "curator",
        });

        const formData = new FormData();
        formData.append("assetId", assetId);
        formData.append("label", label);
        if (file) formData.append("file", file);
        if (extracted) formData.append("extractedMetadata", JSON.stringify(extracted));

        const res = await createAssetVersionAction(formData);
        if (!res.ok || !res.asset) {
          restoreSnapshot(snapshot);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return { ok: false as const, error: res.error ?? "Could not create version." };
        }

        applyCanonicalAssets([res.asset]);
        reconcileFeed();

        return { ok: true as const };
      } catch {
        restoreSnapshot(snapshot);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return { ok: false as const, error: "Could not create version." };
      }
    },
    [assets, collections, registerObjectUrl, addActivity, restoreSnapshot, applyCanonicalAssets, reconcileFeed, takeSnapshot],
  );

  const promoteVersion = useCallback(
    (assetId: string, versionId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const version = asset.versions.find((v) => v.id === versionId);
      if (!version || version.isCurrent) return;

      const snapshot = takeSnapshot();

      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== assetId) return a;
          const versions = a.versions.map((v) => ({ ...v, isCurrent: v.id === versionId }));
          return applyAIAndProduction({ ...a, versions, currentVersionId: versionId }, collections);
        }),
      );

      addActivity({
        assetId,
        assetName: asset.name,
        action: `Version promoted: v${version.versionNumber} — ${version.label}`,
        timestamp: new Date().toISOString(),
        source: "curator",
      });

      runAction(
        snapshot,
        () => promoteVersionAction(assetId, versionId),
        "Could not promote this version.",
      );
    },
    [assets, collections, addActivity, runAction, takeSnapshot],
  );

  const deleteVersion = useCallback(
    (assetId: string, versionId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;
      const version = asset.versions.find((v) => v.id === versionId);
      if (!version || version.isCurrent) return;

      const snapshot = takeSnapshot();

      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? applyAIAndProduction(
                { ...a, versions: a.versions.filter((v) => v.id !== versionId) },
                collections,
              )
            : a,
        ),
      );

      addActivity({
        assetId,
        assetName: asset.name,
        action: `Version deleted: v${version.versionNumber} — ${version.label}`,
        timestamp: new Date().toISOString(),
        source: "curator",
      });

      runAction(
        snapshot,
        () => deleteVersionAction(assetId, versionId),
        "Could not delete this version.",
      );
    },
    [assets, collections, addActivity, runAction, takeSnapshot],
  );

  const ignoreDuplicate = useCallback(
    (duplicateId: string) => {
      const prevSet = ignoredDuplicates;
      setIgnoredDuplicates((prev) => new Set([...prev, duplicateId]));
      void ignoreDuplicateAction(duplicateId)
        .then((res) => {
          if (!res.ok) {
            setIgnoredDuplicates(prevSet);
            fail("Could not ignore duplicate candidate.");
          }
        })
        .catch(() => {
          setIgnoredDuplicates(prevSet);
          fail("Could not ignore duplicate candidate.");
        });
    },
    [ignoredDuplicates, fail],
  );

  const getDuplicateCandidates = useCallback(
    (assetId: string) => findDuplicateCandidates(assets, assetId, ignoredDuplicates),
    [assets, ignoredDuplicates],
  );

  const getRelatedAssets = useCallback(
    (assetId: string) => findRelatedAssets(assets, assetId, collections),
    [assets, collections],
  );

  const getAssetHealth = useCallback(
    (assetId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return null;
      return computeAssetHealth(asset);
    },
    [assets],
  );

  const getAssetTimeline = useCallback(
    (assetId: string) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return [];
      return buildAssetTimeline(asset, activity, feedback, []);
    },
    [assets, activity, feedback],
  );

  const bulkAddTag = useCallback(
    (assetIds: string[], tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      const snapshot = takeSnapshot();
      setAssets((prev) =>
        prev.map((a) =>
          assetIds.includes(a.id) && !a.tags.includes(trimmed)
            ? applyAIAndProduction({ ...a, tags: [...a.tags, trimmed], updatedAt: now }, collections)
            : a,
        ),
      );
      assetIds.forEach((id) => {
        const asset = assets.find((a) => a.id === id);
        if (asset) {
          addActivity({
            assetId: id,
            assetName: asset.name,
            action: `Bulk tag added: "${trimmed}"`,
            timestamp: now,
            source: "curator",
          });
        }
      });
      runAction(
        snapshot,
        () => bulkAddTagAction(assetIds, trimmed),
        "Could not apply bulk tag.",
      );
    },
    [assets, collections, addActivity, runAction, takeSnapshot],
  );

  const bulkRemoveTag = useCallback(
    (assetIds: string[], tag: string) => {
      const now = new Date().toISOString();
      const snapshot = takeSnapshot();
      setAssets((prev) =>
        prev.map((a) =>
          assetIds.includes(a.id)
            ? applyAIAndProduction(
                { ...a, tags: a.tags.filter((t) => t !== tag), updatedAt: now },
                collections,
              )
            : a,
        ),
      );
      runAction(
        snapshot,
        () => bulkRemoveTagAction(assetIds, tag),
        "Could not remove tag.",
      );
    },
    [collections, runAction, takeSnapshot],
  );

  const bulkMoveToCollection = useCallback(
    (assetIds: string[], collectionId: string) => {
      const now = new Date().toISOString();
      const collection = collections.find((c) => c.id === collectionId);
      const snapshot = takeSnapshot();
      setAssets((prev) =>
        prev.map((a) =>
          assetIds.includes(a.id)
            ? applyAIAndProduction({ ...a, collectionId, updatedAt: now }, collections)
            : a,
        ),
      );
      assetIds.forEach((id) => {
        const asset = assets.find((a) => a.id === id);
        if (asset && collection) {
          addActivity({
            assetId: id,
            assetName: asset.name,
            action: `Moved to collection: ${collection.name}`,
            timestamp: now,
            source: "curator",
          });
        }
      });
      runAction(
        snapshot,
        () => bulkMoveToCollectionAction(assetIds, collectionId),
        "Could not move assets to collection.",
      );
    },
    [assets, collections, addActivity, runAction, takeSnapshot],
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
      const snapshot = takeSnapshot();

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

      runAction(
        snapshot,
        () => submitReviewAction(assetId, payload),
        "Could not save review decision.",
      );

      return { ok: true };
    },
    [assets, addActivity, runAction, takeSnapshot],
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
      const snapshot = takeSnapshot();

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

      runAction(
        snapshot,
        () => submitComparisonAction(payload),
        "Could not save comparison decision.",
      );

      return { ok: true };
    },
    [addActivity, runAction, takeSnapshot],
  );

  const getAllDecisionHistory = useCallback(() => {
    return assets
      .flatMap((a) => a.decisionHistory)
      .sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [assets]);

  const resetDemo = useCallback(() => {
    const snapshot = takeSnapshot();
    revokeAllObjectUrls();
    setAiSessions({});
    setIgnoredDuplicates(new Set());

    void (async () => {
      try {
        const res = await resetDemoAction();
        if (!res.ok || !res.snapshot) {
          restoreSnapshot(snapshot);
          fail(res.error ?? "Could not reset the demo workspace.");
          return;
        }
        setAssets(res.snapshot.assets);
        setCollections(res.snapshot.collections);
        setActivity(res.snapshot.activity);
        setComparisons(res.snapshot.comparisons);
        setFeedback(res.snapshot.feedback);
        setIgnoredDuplicates(new Set(res.snapshot.ignoredDuplicateIds));
      } catch {
        restoreSnapshot(snapshot);
        fail("Could not reset the demo workspace.");
      }
    })();
  }, [revokeAllObjectUrls, restoreSnapshot, fail, takeSnapshot]);

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
      metadataIssues: getAssetsWithMetadataIssues(assets, collections),
      possibleDuplicates: countPossibleDuplicates(assets, ignoredDuplicates),
    }),
    [assets, ignoredDuplicates, collections],
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
      uploadAsset,
      updateAssetMetadata,
      createAssetVersion,
      promoteVersion,
      deleteVersion,
      ignoreDuplicate,
      getDuplicateCandidates,
      getRelatedAssets,
      getAssetHealth,
      getAssetTimeline,
      searchAssets,
      bulkAddTag,
      bulkRemoveTag,
      bulkMoveToCollection,
      stats,
      aiStats,
      getAllDecisionHistory,
      resetDemo,
      lastError,
      dismissError,
    }),
    [
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
      uploadAsset,
      updateAssetMetadata,
      createAssetVersion,
      promoteVersion,
      deleteVersion,
      ignoreDuplicate,
      getDuplicateCandidates,
      getRelatedAssets,
      getAssetHealth,
      getAssetTimeline,
      searchAssets,
      bulkAddTag,
      bulkRemoveTag,
      bulkMoveToCollection,
      stats,
      aiStats,
      getAllDecisionHistory,
      resetDemo,
      lastError,
      dismissError,
    ],
  );

  return (
    <AssetsContext.Provider value={value}>
      {children}
      {lastError ? (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <span className="flex-1">{lastError}</span>
            <button
              type="button"
              onClick={dismissError}
              aria-label="Dismiss error"
              className="text-red-500 transition-colors hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </AssetsContext.Provider>
  );
}

export function useAssets() {
  const context = useContext(AssetsContext);
  if (!context) {
    throw new Error("useAssets must be used within AssetsProvider");
  }
  return context;
}
