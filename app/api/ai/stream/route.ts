import { GoogleGenAI, type Part } from "@google/genai";
import { AIAnalysisSchema } from "@/lib/ai/schemas";
import {
  ANALYZE_SYSTEM_INSTRUCTION,
  MODEL,
  buildAnalyzeContents,
  createGeminiClient,
  extractJson,
  loadMediaParts,
  loadMediaPartFromPath,
} from "@/lib/ai/gemini-provider";
import { generateAIAnalysis } from "@/lib/generate-ai-analysis";
import { inferUploadCategory, mapCategoryToAssetType } from "@/lib/file-metadata";
import { parseExtractedMetadata } from "@/lib/server/mappers";
import { getAssetById, getCollections } from "@/lib/server/queries";
import { buildUploadedAsset } from "@/lib/upload-asset";
import type { AIAnalysis, Asset } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROGRESS_STEPS = [
  "Extracting keyframes...",
  "Generating tags...",
  "Evaluating production readiness...",
];

type AnalyzeTarget =
  | { kind: "asset"; asset: Asset; collections: Awaited<ReturnType<typeof getCollections>> }
  | {
      kind: "upload";
      asset: Asset;
      collections: Awaited<ReturnType<typeof getCollections>>;
      mediaPart: Part | null;
    };

const encoder = new TextEncoder();

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Pushes a small preamble containing the analysis model so the client can
 * label the stream as "live Gemini" vs "local mock".
 */
function preamble(target: AnalyzeTarget): string {
  return sse("meta", {
    model: process.env.GEMINI_API_KEY ? "gemini-2.0-flash (live)" : "local mock",
    assetId: target.asset.id,
    assetName: target.asset.name,
  });
}

async function* mockStream(target: AnalyzeTarget): AsyncGenerator<string> {
  for (const step of PROGRESS_STEPS) {
    yield sse("progress", { step });
    // simulate work between progress steps
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const analysis = generateAIAnalysis(target.asset, target.collections);
  yield sse("done", analysis);
}

async function* geminiStream(target: AnalyzeTarget): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const client: GoogleGenAI = createGeminiClient(apiKey);

  yield sse("progress", { step: "Extracting keyframes..." });

  const mediaParts =
    target.kind === "upload"
      ? target.mediaPart
        ? [target.mediaPart]
        : []
      : await loadMediaParts(target.asset);

  const contents = buildAnalyzeContents(target.asset, target.collections, mediaParts);

  yield sse("progress", { step: "Generating tags..." });

  const response = await client.models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction: ANALYZE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  let raw = "";
  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      raw += text;
      yield sse("chunk", { text });
    }
  }

  yield sse("progress", { step: "Evaluating production readiness..." });

  let analysis: AIAnalysis;
  try {
    const parsed = AIAnalysisSchema.parse(extractJson(raw));
    analysis = { ...parsed, generatedAt: new Date().toISOString() };
  } catch (error) {
    console.warn("[ai/stream] invalid Gemini output; falling back to mock.", error);
    analysis = generateAIAnalysis(target.asset, target.collections);
  }
  yield sse("done", analysis);
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    let target: AnalyzeTarget;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const collectionId = (form.get("collectionId") as string | null)?.trim() || "col-archive-draft";
      const extractedRaw = form.get("extractedMetadata");
      if (!(file instanceof File) || typeof extractedRaw !== "string") {
        return new Response(JSON.stringify({ error: "Invalid upload payload." }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const extracted = parseExtractedMetadata(JSON.parse(extractedRaw));
      const collections = await getCollections();
      const category = inferUploadCategory(file);
      const type = mapCategoryToAssetType(category);
      const assetId = `asset-stream-${Date.now()}`;
      const mediaPath = `/media/ver-${assetId}-1-${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
      const asset = buildUploadedAsset(extracted, type, mediaPath, collectionId, collections, {
        id: assetId,
        isSessionUpload: false,
      });

      // Pass the freshly-uploaded bytes straight to Gemini as inline media.
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mediaPart: Part | null = file.size > 0
        ? { inlineData: { data: bytesToBase64(bytes), mimeType: file.type || "application/octet-stream" } }
        : await loadMediaPartFromPath(mediaPath);

      target = { kind: "upload", asset, collections, mediaPart };
    } else {
      let assetId: string;
      try {
        const body = await request.json();
        assetId = body?.assetId;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      if (typeof assetId !== "string" || !assetId) {
        return new Response(JSON.stringify({ error: "assetId is required." }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const [asset, collections] = await Promise.all([getAssetById(assetId), getCollections()]);
      if (!asset || !collections) {
        return new Response(JSON.stringify({ error: "Asset not found." }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      target = { kind: "asset", asset, collections };
    }

    const source = process.env.GEMINI_API_KEY?.trim()
      ? geminiStream(target)
      : mockStream(target);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(preamble(target)));
        try {
          for await (const event of source) {
            controller.enqueue(encoder.encode(event));
          }
        } catch (error) {
          console.error("[ai/stream] stream error", error);
          controller.enqueue(
            encoder.encode(
              sse("error", { message: "AI analysis stream failed." }),
            ),
          );
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[ai/stream] failed", error);
    return new Response(JSON.stringify({ error: "AI analysis stream failed." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
