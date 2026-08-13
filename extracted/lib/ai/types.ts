import type { Asset, AIAnalysis, AIComparisonSummary, Collection } from "@/types";

export interface AIAnalysisProvider {
  analyze(asset: Asset, collections: Collection[]): AIAnalysis;
  compare(assetA: Asset, assetB: Asset, collections: Collection[]): AIComparisonSummary;
}
