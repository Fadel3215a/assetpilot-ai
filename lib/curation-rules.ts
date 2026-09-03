import type { Asset, AssetAISessionState } from "@/types";
import { calculateCuratorScore, createDefaultChecklist } from "@/lib/quality";
import { getCurrentVersion } from "@/lib/utils";

export const AUTOMATED_RULES = [
  { id: "quality", label: "Quality score exceeds threshold" },
  { id: "observations", label: "No unresolved observations" },
  { id: "checklist", label: "Mandatory checklist cleared" },
] as const;

export type AutomatedRuleId = (typeof AUTOMATED_RULES)[number]["id"];

export interface CurationRuleResult {
  id: AutomatedRuleId;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface CurationEvaluation {
  rules: CurationRuleResult[];
  ready: boolean;
}

const QUALITY_THRESHOLD = 85;

/**
 * Stage 4.2 — Automated curation rules engine.
 *
 * Determines whether an asset qualifies for automatic PRODUCTION_READY status
 * by evaluating three objective criteria with no human-in-the-loop dependency:
 *   1. Quality   — the current version's curator score (> 85).
 *   2. Observations — zero AI observations still unresolved (not yet accepted
 *      and not dismissed in the asset's session state).
 *   3. Checklist — the mandatory curation checklist is fully cleared (no
 *      NEEDS_REVIEW/FAIL ratings on the current version).
 *
 * Pure function: callers pass the asset plus the observation-resolved state and
 * decide how to persist the resulting transition (see the server actions).
 */
export function evaluateCurationRules(
  asset: Asset,
  session?: AssetAISessionState,
): CurationEvaluation {
  const version = getCurrentVersion(asset);
  const checklist = version.curatorChecklist ?? createDefaultChecklist();
  const curatorScore = version.curatorScore ?? calculateCuratorScore(checklist);

  // Unresolved observations: AI observations neither accepted nor dismissed.
  const resolvedIds = new Set<string>([
    ...(session?.acceptedObservationIds ?? []),
    ...(session?.dismissedObservationIds ?? []),
  ]);
  const unresolvedObservations = (asset.aiAnalysis.observations ?? []).filter(
    (o) => !resolvedIds.has(o.id),
  ).length;

  const qualityPass = curatorScore > QUALITY_THRESHOLD;
  const observationsPass = unresolvedObservations === 0;
  const checklistPass =
    checklist.length > 0 && !checklist.some((c) => c.rating === "FAIL" || c.rating === "NEEDS_REVIEW");

  const rules: CurationRuleResult[] = [
    {
      id: "quality",
      label: "Quality score exceeds threshold",
      passed: qualityPass,
      detail: qualityPass
        ? `Curator score ${curatorScore} > ${QUALITY_THRESHOLD}`
        : `Curator score ${curatorScore} <= ${QUALITY_THRESHOLD}`,
    },
    {
      id: "observations",
      label: "No unresolved observations",
      passed: observationsPass,
      detail: observationsPass
        ? "All AI observations resolved"
        : `${unresolvedObservations} unresolved observation(s)`,
    },
    {
      id: "checklist",
      label: "Mandatory checklist cleared",
      passed: checklistPass,
      detail: checklistPass
        ? "Checklist has no pending or failing criteria"
        : "Checklist still has NEEDS_REVIEW/FAIL criteria",
    },
  ];

  return { rules, ready: qualityPass && observationsPass && checklistPass };
}

/**
 * Returns the list of observation IDs an asset's session has not yet resolved.
 * Useful for surfacing the outstanding observations in rule details.
 */
export function unresolvedObservationIds(
  asset: Asset,
  session?: AssetAISessionState,
): string[] {
  const resolvedIds = new Set<string>([
    ...(session?.acceptedObservationIds ?? []),
    ...(session?.dismissedObservationIds ?? []),
  ]);
  return (asset.aiAnalysis.observations ?? [])
    .map((o) => o.id)
    .filter((id) => !resolvedIds.has(id));
}
