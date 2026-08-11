import type { ComparisonRecord } from "@/types";

export const mockComparisons: ComparisonRecord[] = [
  {
    id: "cmp-001",
    timestamp: "2026-07-06T10:00:00Z",
    reviewer: "Alex Chen",
    itemA: { assetId: "asset-001", versionId: "ver-001-2", label: "Nebula Portal v2" },
    itemB: { assetId: "asset-001", versionId: "ver-001-3", label: "Nebula Portal v3" },
    decision: "PREFER_B",
    reason: "v3 color grade is cleaner and portal edge reads better at hero size.",
  },
  {
    id: "cmp-002",
    timestamp: "2026-07-09T14:00:00Z",
    reviewer: "Jordan Lee",
    itemA: { assetId: "asset-003", versionId: "ver-003-1", label: "Orbital Loop v1" },
    itemB: { assetId: "asset-003", versionId: "ver-003-2", label: "Orbital Loop v2" },
    decision: "PREFER_B",
    reason: "v2 eliminates flicker artifacts visible in the first pass.",
  },
];
