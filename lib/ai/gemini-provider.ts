import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  GoogleGenAI,
  createPartFromBase64,
  type Content,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import { AIAnalysisSchema, AIComparisonSummarySchema } from "@/lib/ai/schemas";
import {
  generateAIAnalysis,
  generateComparisonSummary,
} from "@/lib/generate-ai-analysis";
import { getCurrentVersion } from "@/lib/utils";
import type { AIAnalysis, AIComparisonSummary, Asset, Collection } from "@/types";
import type { AsyncAIAnalysisProvider } from "./types";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const MODEL = "gemini-2.0-flash";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

function resolveLocalMediaPath(mediaUrl: string): string | null {
  if (!mediaUrl.startsWith("/media/")) return null;
  const segments = mediaUrl.replace(/^\/media\//, "").split("/").filter(Boolean);
  const safe = segments.map((s) => s.replace(/[^A-Za-z0-9._-]/g, "_"));
  const target = path.resolve(STORAGE_ROOT, ...safe);
  if (!target.startsWith(STORAGE_ROOT + path.sep)) return null;
  return target;
}

/**
 * Loads an asset's on-disk media (image, audio, or video) as Gemini inline
 * data parts. Only files under `storage/uploads/` referenced via `/media/`
 * are considered; static mock thumbnails (e.g. SVG placeholders) are skipped.
 * Returns an empty array when nothing usable is on disk, letting the caller
 * fall back to metadata-only analysis.
 */
export async function loadMediaParts(asset: Asset): Promise<Part[]> {
  const version = getCurrentVersion(asset);
  const mediaUrl = version.previewPath ?? version.mediaUrl;
  if (!mediaUrl) return [];

  const target = resolveLocalMediaPath(mediaUrl);
  if (!target) return [];

  const mimeType = MIME_BY_EXTENSION[path.extname(target).toLowerCase()];
  if (!mimeType) return [];

  try {
    const buffer = await readFile(target);
    return [createPartFromBase64(buffer.toString("base64"), mimeType)];
  } catch {
    return [];
  }
}

/**
 * Reads a file's raw bytes from the local `/media/` tree as an inline-data
 * part. Used to attach a freshly-written upload to a streaming Gemini request
 * before a canonical asset record exists on disk under that version id.
 */
export async function loadMediaPartFromPath(mediaPath: string): Promise<Part | null> {
  const target = resolveLocalMediaPath(mediaPath);
  if (!target) return null;
  const mimeType = MIME_BY_EXTENSION[path.extname(target).toLowerCase()];
  if (!mimeType) return null;
  try {
    const buffer = await readFile(target);
    return createPartFromBase64(buffer.toString("base64"), mimeType);
  } catch {
    return null;
  }
}

function contextOfAsset(asset: Asset, collections: Collection[]): string {
  const collection = collections.find((c) => c.id === asset.collectionId);
  const version = getCurrentVersion(asset);
  return JSON.stringify(
    {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      status: asset.status,
      priority: asset.priority,
      tags: asset.tags,
      collectionId: asset.collectionId,
      collectionName: collection?.name ?? null,
      isAiGenerated: asset.isAiGenerated,
      usageNotes: asset.usageNotes,
      source: version.metadata.generator ?? null,
      format: version.metadata.format,
      dimensions: version.metadata.dimensions,
      prompt: version.metadata.prompt,
      description: version.metadata.description,
      version: version.versionNumber,
      qualityScore: version.qualityScore.overall,
      curatorReview: version.reviewDecision.type,
    },
    null,
    2,
  );
}

export const ANALYZE_SYSTEM_INSTRUCTION =
  "You are AssetPilot, an expert digital asset curator for a human-in-the-loop DAM system. " +
  "Analyze an asset from its metadata and (when provided) its media to help a human curator. " +
  'Return strictly valid JSON matching this shape: ' +
  '{"summary":"string","strengths":["string"],"potentialIssues":["string"],' +
  '"suggestedTags":[{"id":"string","tag":"string","explanation":"string"}],' +
  '"suggestedCollectionId":"string","suggestedCollectionExplanation":"string",' +
  '"productionSuggestion":{"recommendation":"READY_FOR_VERIFICATION"|"REVIEW_REQUIRED"|"NOT_RECOMMENDED","summary":"string","explanation":"string"},' +
  '"observations":[{"id":"string","text":"string","explanation":"string"}],' +
  '"confidence":"high"|"medium"|"low","generatedAt":"string"}. ' +
  "Suggested tag ids must be unique per asset. generatedAt should be the current ISO timestamp. " +
  "Do not invent facts not supported by the provided metadata.";

const COMPARE_SYSTEM_INSTRUCTION =
  "You are AssetPilot, an expert digital asset curator for a human-in-the-loop DAM system. " +
  "Compare two assets from their metadata to advise which better suits production. " +
  'Return strictly valid JSON matching this shape: ' +
  '{"assetAStrengths":["string"],"assetBStrengths":["string"],' +
  '"keyDifferences":["string"],"potentialConcerns":["string"],' +
  '"suggestedDirection":"string","explanation":"string"}. ' +
  "Support the human curator by pointing out measurable differences and mention that visual " +
  "grounding is limited without pixel-level analysis.";

function extractJson(content: string | undefined): unknown {
  if (!content) return null;
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) return JSON.parse(match[1]);
  }
  return JSON.parse(trimmed);
}

function responseText(response: GenerateContentResponse): string | undefined {
  return response.text;
}

export { extractJson, responseText, MODEL };

/**
 * Builds the user `Content` (text + any media parts) for a single-asset
 * analysis request. Shared by the provider and the streaming route so both
 * produce identical prompts.
 */
export function buildAnalyzeContents(
  asset: Asset,
  collections: Collection[],
  mediaParts: Part[],
): Content {
  return {
    role: "user",
    parts: [
      {
        text: `Analyze this digital asset:\n${contextOfAsset(asset, collections)}`,
      },
      ...mediaParts,
    ],
  };
}

export class GeminiAIAnalysisProvider implements AsyncAIAnalysisProvider {
  private readonly genAI: GoogleGenAI;

  constructor(apiKey: string) {
    this.genAI = createGeminiClient(apiKey);
  }

  async analyze(asset: Asset, collections: Collection[]): Promise<AIAnalysis> {
    try {
      const mediaParts = await loadMediaParts(asset);
      const response = await this.genAI.models.generateContent({
        model: MODEL,
        contents: [buildAnalyzeContents(asset, collections, mediaParts)],
        config: {
          systemInstruction: ANALYZE_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      const parsed = AIAnalysisSchema.parse(extractJson(responseText(response)));
      return {
        ...parsed,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.warn(`[Gemini] analyze failed for ${asset.id}; falling back to mock provider.`, error);
      return generateAIAnalysis(asset, collections);
    }
  }

  async compare(
    assetA: Asset,
    assetB: Asset,
    collections: Collection[],
  ): Promise<AIComparisonSummary> {
    try {
      const [mediaA, mediaB] = await Promise.all([
        loadMediaParts(assetA),
        loadMediaParts(assetB),
      ]);
      const parts: Part[] = [
        {
          text:
            "Compare these two digital assets:\n--- ASSET A ---\n" +
            contextOfAsset(assetA, collections) +
            "\n--- ASSET B ---\n" +
            contextOfAsset(assetB, collections),
        },
        ...mediaA,
        ...mediaB,
      ];

      const response = await this.genAI.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts } satisfies Content],
        config: {
          systemInstruction: COMPARE_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      return AIComparisonSummarySchema.parse(extractJson(responseText(response)));
    } catch (error) {
      console.warn("[Gemini] compare failed; falling back to mock provider.", error);
      return generateComparisonSummary(assetA, assetB, collections);
    }
  }
}
