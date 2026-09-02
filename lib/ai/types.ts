import type { Asset, AIAnalysis, AIComparisonSummary, Collection } from "@/types";

export interface AIAnalysisProvider {
  analyze(asset: Asset, collections: Collection[]): AIAnalysis;
  compare(assetA: Asset, assetB: Asset, collections: Collection[]): AIComparisonSummary;
}

export interface AsyncAIAnalysisProvider {
  analyze(asset: Asset, collections: Collection[]): Promise<AIAnalysis>;
  compare(assetA: Asset, assetB: Asset, collections: Collection[]): Promise<AIComparisonSummary>;
}
