import { prisma } from "@/lib/db";
import {
  toDomainActivity,
  toDomainAsset,
  toDomainCollection,
  toDomainComparison,
  toDomainFeedback,
} from "@/lib/server/mappers";
import type {
  ActivityItem,
  Asset,
  Collection,
  ComparisonRecord,
  CuratorFeedbackEntry,
} from "@/types";

export async function getCollections(): Promise<Collection[]> {
  const rows = await prisma.collection.findMany({ orderBy: { name: "asc" } });
  return rows.map(toDomainCollection);
}

export async function getAssets(): Promise<Asset[]> {
  const rows = await prisma.asset.findMany({
    include: { versions: true, decisionHistory: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toDomainAsset);
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const row = await prisma.asset.findUnique({
    where: { id },
    include: { versions: true, decisionHistory: true },
  });
  return row ? toDomainAsset(row) : null;
}

export async function getActivity(): Promise<ActivityItem[]> {
  const rows = await prisma.activityItem.findMany({
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  });
  return rows.map(toDomainActivity);
}

export async function getComparisons(): Promise<ComparisonRecord[]> {
  const rows = await prisma.comparisonRecord.findMany({
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  });
  return rows.map(toDomainComparison);
}

export async function getFeedbackEntries(): Promise<CuratorFeedbackEntry[]> {
  const rows = await prisma.curatorFeedbackEntry.findMany({
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  });
  return rows.map(toDomainFeedback);
}

export async function getIgnoredDuplicateIds(): Promise<string[]> {
  const rows = await prisma.ignoredDuplicate.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => row.duplicateId);
}
