import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { buildExportZip, resolveMediaFile } from "@/lib/export";
import { deriveRenditions, fileExtensionOf } from "@/lib/renditions";
import {
  getAssetById,
  getAssets,
  getCollections,
  reindexAllAssets,
} from "@/lib/server/queries";
import { getCurrentVersion } from "@/lib/utils";
import type {
  Asset,
  BackgroundJobData,
  BackgroundJobType,
  ConvertRenditionJobData,
  ExportZipJobData,
  ReindexVectorsJobData,
} from "@/types";

/**
 * Stage 5.1 — Shared background job executor.
 *
 * Runs the three dispatcher job types (EXPORT_ZIP, CONVERT_RENDITION,
 * REINDEX_VECTORS) with a generic `report(percent, step)` hook so the same code
 * powers both execution modes:
 *   - the BullMQ worker (production, Redis) — progress maps to
 *     `job.updateProgress(...)`; the returned value becomes `returnvalue`.
 *   - the in-process fallback runner (no Redis) — progress maps to
 *     `jobStore` updates streamed over the `/api/jobs/[id]/progress` SSE.
 *
 * Deliberately avoids the `"use server"` action module so this file stays safe
 * to import from a standalone worker process (see lib/server/worker-orchestration
 * for the same constraint).
 *
 * Handlers throw `Error(message)` on failure; runners translate that into the
 * job's terminal FAILED state / BullMQ failedReason.
 */

export interface BackgroundJobContext {
  type: BackgroundJobType;
  data: BackgroundJobData;
  report: (progressPercent: number, stepLabel: string) => void;
}

export async function executeBackgroundJob(
  ctx: BackgroundJobContext,
): Promise<unknown> {
  switch (ctx.type) {
    case "EXPORT_ZIP":
      return runExportZip(ctx.data as ExportZipJobData, ctx.report);
    case "CONVERT_RENDITION":
      return runConvertRendition(ctx.data as ConvertRenditionJobData, ctx.report);
    case "REINDEX_VECTORS":
      return runReindexVectors(ctx.data as ReindexVectorsJobData, ctx.report);
    default:
      throw new Error(`Unknown background job type: ${String(ctx.type)}`);
  }
}

function runExportZip(
  data: ExportZipJobData,
  report: BackgroundJobContext["report"],
): Promise<unknown> {
  return (async () => {
    const assetIds = (data.assetIds ?? []).map((s) => s.trim()).filter(Boolean);
    const collectionId = data.collectionId?.trim();

    report(5, "Loading assets…");

    let assets: Asset[];
    if (collectionId) {
      const all = await getAssets();
      assets = all.filter((a) => a.collectionId === collectionId);
    } else if (assetIds.length > 0) {
      const loaded: Asset[] = [];
      for (const id of assetIds) {
        const asset = await getAssetById(id);
        if (asset) loaded.push(asset);
      }
      assets = loaded;
    } else {
      throw new Error("Provide assetIds[] or a collectionId to export.");
    }

    if (assets.length === 0) {
      throw new Error("No assets matched the export request.");
    }

    const collections = await getCollections();
    const collection =
      collectionId ? collections.find((c) => c.id === collectionId) : undefined;
    const label =
      data.label?.trim() ||
      collection?.name ||
      (assets.length === 1 ? assets[0].name : "assets");

    report(25, `Packaging ${assets.length} asset${assets.length === 1 ? "" : "s"}…`);
    const { buffer, fileName } = await buildExportZip(assets, collections, label, (done, total) => {
      report(25 + Math.round((done / total) * 65), `Packaging ${done}/${total}…`);
    });

    report(92, "Finalizing archive…");
    return {
      fileName,
      sizeBytes: buffer.byteLength,
      base64: buffer.toString("base64"),
    };
  })();
}

function runConvertRendition(
  data: ConvertRenditionJobData,
  report: BackgroundJobContext["report"],
): Promise<unknown> {
  return (async () => {
    const assetId = data.assetId?.trim();
    if (!assetId) throw new Error("An assetId is required for rendition conversion.");

    report(10, "Loading asset…");
    const asset = await getAssetById(assetId);
    if (!asset) throw new Error("Asset not found.");

    const current = getCurrentVersion(asset);
    const versionId = data.versionId?.trim() || current.id;
    const version =
      versionId === current.id
        ? current
        : asset.versions.find((v) => v.id === versionId);
    if (!version) throw new Error("Version not found.");

    const source =
      resolveMediaFile(version.mediaUrl) ??
      resolveMediaFile(version.previewPath) ??
      resolveMediaFile(version.thumbnailPath);
    if (!source) {
      throw new Error("No source media file found on disk for this version.");
    }

    report(30, "Reading source file…");
    let buffer: Buffer;
    try {
      buffer = await readFile(source);
    } catch (error) {
      throw new Error(
        `Unable to read source file ${source}: ${(error as Error).message}`,
      );
    }

    const ext = fileExtensionOf(source) || path.extname(source).toLowerCase();
    if (!ext) throw new Error("Could not determine the source media type.");

    report(55, "Deriving renditions…");
    const rendition = await deriveRenditions(buffer, assetId, ext);
    if (!rendition) {
      return {
        derived: false,
        versionId: version.id,
        note: "No derivatives generated for this media type (or decoding failed).",
      };
    }

    report(80, "Persisting renditions…");
    await prisma.assetVersion.update({
      where: { id: version.id },
      data: {
        thumbnailPath: rendition.thumbnailPath,
        previewPath: rendition.previewPath,
      },
    });

    report(100, "Complete");
    return {
      derived: true,
      versionId: version.id,
      thumbnailPath: rendition.thumbnailPath,
      previewPath: rendition.previewPath,
    };
  })();
}

function runReindexVectors(
  _data: ReindexVectorsJobData,
  report: BackgroundJobContext["report"],
): Promise<unknown> {
  return (async () => {
    report(5, "Loading inventory…");
    const result = await reindexAllAssets((processed, total) => {
      report(10 + Math.round((processed / total) * 80), `Re-indexing ${processed}/${total}…`);
    });

    report(95, "Finalizing index…");
    return result;
  })();
}