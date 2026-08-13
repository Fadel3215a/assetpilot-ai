import type { AIAnalysisProvider } from "./types";
import { defaultAIAnalysisProvider } from "./mock-provider";

let provider: AIAnalysisProvider = defaultAIAnalysisProvider;

export function getAIAnalysisProvider(): AIAnalysisProvider {
  return provider;
}

export function setAIAnalysisProvider(next: AIAnalysisProvider): void {
  provider = next;
}

export type { AIAnalysisProvider } from "./types";
export { MockAIAnalysisProvider } from "./mock-provider";
