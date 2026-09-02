import type { AsyncAIAnalysisProvider } from "@/lib/ai";
import { MockAIAnalysisProvider } from "@/lib/ai";
import type { Asset, Collection } from "@/types";

/**
 * A thin wrapper exposing the deterministic mock provider through the async
 * interface, so server-side code never has to branch on configuration.
 */
class AsyncMockAIAnalysisProvider implements AsyncAIAnalysisProvider {
  analyze(asset: Asset, collections: Collection[]) {
    return Promise.resolve(new MockAIAnalysisProvider().analyze(asset, collections));
  }
  compare(assetA: Asset, assetB: Asset, collections: Collection[]) {
    return Promise.resolve(new MockAIAnalysisProvider().compare(assetA, assetB, collections));
  }
}

let asyncProvider: AsyncAIAnalysisProvider | null = null;

/**
 * Server-only entry point for real AI analysis. When `GEMINI_API_KEY` is set
 * in the environment this returns a Gemini-backed provider (which falls back
 * to the mock on any failure); otherwise it returns a Mock wrapper so callers
 * always have a valid provider regardless of configuration.
 *
 * This module lives under `lib/server/` so it is never shipped to the client,
 * keeping Node-only modules (e.g. `node:fs/promises`) out of the browser
 * bundle.
 */
export async function getAsyncAIAnalysisProvider(): Promise<AsyncAIAnalysisProvider> {
  if (asyncProvider) return asyncProvider;

  const key = process.env.GEMINI_API_KEY?.trim();
  if (key) {
    const { GeminiAIAnalysisProvider } = await import("@/lib/ai/gemini-provider");
    asyncProvider = new GeminiAIAnalysisProvider(key);
  } else {
    asyncProvider = new AsyncMockAIAnalysisProvider();
  }
  return asyncProvider;
}
