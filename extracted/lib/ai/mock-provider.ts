import {
  generateAIAnalysis,
  generateComparisonSummary,
} from "@/lib/generate-ai-analysis";
import type { Asset, Collection } from "@/types";
import type { AIAnalysisProvider } from "./types";

export class MockAIAnalysisProvider implements AIAnalysisProvider {
  analyze(asset: Asset, collections: Collection[]) {
    return generateAIAnalysis(asset, collections);
  }

  compare(assetA: Asset, assetB: Asset, collections: Collection[]) {
    return generateComparisonSummary(assetA, assetB, collections);
  }
}

export const defaultAIAnalysisProvider = new MockAIAnalysisProvider();
