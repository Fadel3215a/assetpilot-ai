import type { AIAnalysis } from "./ai";

export type AssetType = "image" | "video" | "audio" | "3d";

export type AssetStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "PRODUCTION_READY";

export type ReviewDecisionType =
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "PENDING";

export type QueuePriority = "high" | "medium" | "low";

export type ChecklistRating = "PASS" | "NEEDS_REVIEW" | "FAIL";

export type ComparisonDecisionType =
  | "PREFER_A"
  | "PREFER_B"
  | "KEEP_BOTH"
  | "REJECT_BOTH";

export interface AssetMetadata {
  title: string;
  description: string;
  prompt?: string;
  generator?: string;
  dimensions?: { width: number; height: number };
  duration?: number;
  format: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface QualityScore {
  overall: number;
  visualClarity?: number;
  consistency?: number;
  technicalQuality?: number;
  brandAlignment?: number;
  notes?: string;
}

export interface QualityCriterion {
  id: string;
  label: string;
  rating: ChecklistRating;
}

export interface ProductionReadiness {
  score: number;
  checklist: {
    id: string;
    label: string;
    completed: boolean;
  }[];
  readyAt?: string;
}

export interface ReviewDecision {
  type: ReviewDecisionType;
  reviewer: string;
  decidedAt: string;
  notes?: string;
}

export interface Review {
  id: string;
  assetId: string;
  versionId: string;
  decision: ReviewDecision;
  qualityScore: QualityScore;
  createdAt: string;
}

export interface DecisionHistoryEntry {
  id: string;
  assetId: string;
  timestamp: string;
  reviewer: string;
  previousStatus: AssetStatus;
  newStatus: AssetStatus;
  decision: ReviewDecisionType;
  reason?: string;
  curatorScore?: number;
}

export interface ComparisonRecord {
  id: string;
  timestamp: string;
  reviewer: string;
  itemA: { assetId: string; versionId: string; label: string };
  itemB: { assetId: string; versionId: string; label: string };
  decision: ComparisonDecisionType;
  reason: string;
}

export interface AssetVersion {
  id: string;
  versionNumber: number;
  label: string;
  thumbnailPath: string;
  previewPath: string;
  metadata: AssetMetadata;
  qualityScore: QualityScore;
  reviewDecision: ReviewDecision;
  curatorChecklist?: QualityCriterion[];
  curatorScore?: number;
  createdAt: string;
  isCurrent: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  collectionId: string;
  tags: string[];
  isAiGenerated: boolean;
  priority: QueuePriority;
  currentVersionId: string;
  versions: AssetVersion[];
  productionReadiness: ProductionReadiness;
  decisionHistory: DecisionHistoryEntry[];
  aiAnalysis: AIAnalysis;
  createdAt: string;
  updatedAt: string;
}

export type ActivitySource = "ai" | "curator";

export interface ActivityItem {
  id: string;
  assetId: string;
  assetName: string;
  action: string;
  timestamp: string;
  source: ActivitySource;
}
