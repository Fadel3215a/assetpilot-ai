import { z } from "zod";

export const AIConfidenceLevelSchema = z.enum(["high", "medium", "low"]);

export const AIProductionSuggestionSchema = z.enum([
  "READY_FOR_VERIFICATION",
  "REVIEW_REQUIRED",
  "NOT_RECOMMENDED",
]);

export const AITagSuggestionSchema = z.object({
  id: z.string(),
  tag: z.string(),
  explanation: z.string(),
});

export const AIQualityObservationSchema = z.object({
  id: z.string(),
  text: z.string(),
  explanation: z.string(),
});

export const AIProductionSuggestionDetailSchema = z.object({
  recommendation: AIProductionSuggestionSchema,
  summary: z.string(),
  explanation: z.string(),
});

export const AIAnalysisSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  potentialIssues: z.array(z.string()),
  suggestedTags: z.array(AITagSuggestionSchema),
  suggestedCollectionId: z.string(),
  suggestedCollectionExplanation: z.string(),
  productionSuggestion: AIProductionSuggestionDetailSchema,
  observations: z.array(AIQualityObservationSchema),
  confidence: AIConfidenceLevelSchema,
  generatedAt: z.string(),
});

export const AIComparisonSummarySchema = z.object({
  assetAStrengths: z.array(z.string()),
  assetBStrengths: z.array(z.string()),
  keyDifferences: z.array(z.string()),
  potentialConcerns: z.array(z.string()),
  suggestedDirection: z.string(),
  explanation: z.string(),
});
