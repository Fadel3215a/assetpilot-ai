import { createGeminiClient } from "@/lib/ai/gemini-provider";

/**
 * Stage 4.1 — Unified embedding generator.
 *
 * `generateEmbedding` is the single entry point used by the search pipeline for
 * both indexing (`lib/search.ts`) and query-time encoding. Embeddings are always
 * exactly `EMBEDDING_DIMENSIONS` (1536) wide so they fit the pgvector
 * `vector(1536)` column and its HNSW `vector_cosine_ops` index.
 *
 * Provider precedence, mirroring the rest of the AI layer:
 *   1. OpenAI  — `text-embedding-3-small` (1536 dims natively) when
 *                `OPENAI_API_KEY` is set. Called via the REST API so no SDK
 *                dependency is required.
 *   2. Gemini  — `gemini-embedding-001` (3072 dims native) when
 *                `GEMINI_API_KEY` is set; down-projected to the first 1536
 *                components (pgvector HNSW/IVFFlat cap is 2000).
 *   3. Mock    — deterministic local hashing embedding so every pipeline works
 *                offline with no keys configured.
 *
 * Any provider failure degrades to the next one, never throwing, so search can
 * never be broken by a flaky upstream.
 */

export const EMBEDDING_DIMENSIONS = 1536;

/** Hard cap on prompt text so embedding calls stay well under token limits. */
const MAX_EMBEDDING_CHARS = 30_000;

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";

function openaiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

function geminiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

function normalizeInput(text: string): string {
  return text.normalize("NFKC").slice(0, MAX_EMBEDDING_CHARS);
}

/**
 * Deterministic, dependency-free hashing embedding. Produces a fixed-width unit
 * vector so cosine similarity is meaningful, giving a "lexical bag of words"
 * fallback when no provider key is configured.
 */
export function fallbackEmbedding(
  text: string,
  dimensions = EMBEDDING_DIMENSIONS,
): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const positiveHash = h >>> 0;
    const idx = positiveHash % dimensions;
    const sign = (positiveHash >> 16) & 1 ? 1 : -1;
    vec[idx] += sign;
  }

  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
  return vec;
}

async function openaiEmbedding(text: string): Promise<number[] | null> {
  const key = openaiKey();
  if (!key) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: text }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI embeddings request failed (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: { embedding?: number[] }[];
  };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("OpenAI embeddings response was empty.");
  }
  return embedding.slice(0, EMBEDDING_DIMENSIONS);
}

async function geminiEmbedding(text: string): Promise<number[] | null> {
  const key = geminiKey();
  if (!key) return null;

  const client = createGeminiClient(key);
  const response = await client.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length < EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Gemini embedding returned ${values?.length ?? 0} dims (expected >= ${EMBEDDING_DIMENSIONS}).`,
    );
  }
  return values.slice(0, EMBEDDING_DIMENSIONS);
}

/**
 * Generates an embedding vector for arbitrary text, defaulting to the
 * deterministic local embedding on any missing key or upstream failure.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const input = normalizeInput(text);
  if (!input.trim()) return fallbackEmbedding("");

  if (openaiKey()) {
    try {
      const embedding = await openaiEmbedding(input);
      if (embedding) return embedding;
    } catch (error) {
      console.warn("[embeddings] OpenAI embedding failed; trying Gemini.", error);
    }
  }

  if (geminiKey()) {
    try {
      const embedding = await geminiEmbedding(input);
      if (embedding) return embedding;
    } catch (error) {
      console.warn("[embeddings] Gemini embedding failed; using fallback.", error);
    }
  }

  return fallbackEmbedding(input);
}