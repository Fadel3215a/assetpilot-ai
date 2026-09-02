import type { AIAnalysisProvider } from "./types";
import { defaultAIAnalysisProvider } from "./mock-provider";

let provider: AIAnalysisProvider = defaultAIAnalysisProvider;

/**
 * Returns the synchronous provider used by client-side code and rule-based
 * seed enrichment. Emits local deterministic analysis; never performs network
 * calls and never requires `GEMINI_API_KEY`.
 */
export function getAIAnalysisProvider(): AIAnalysisProvider {
  return provider;
}

export function setAIAnalysisProvider(next: AIAnalysisProvider): void {
  provider = next;
}

export type { AIAnalysisProvider, AsyncAIAnalysisProvider } from "./types";
export { MockAIAnalysisProvider } from "./mock-provider";
