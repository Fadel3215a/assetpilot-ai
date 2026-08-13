export type AIConfidenceLevel = "high" | "medium" | "low";

export type AIProductionSuggestion =
  | "READY_FOR_VERIFICATION"
  | "REVIEW_REQUIRED"
  | "NOT_RECOMMENDED";

export type CuratorFeedbackAction = "accepted" | "edited" | "dismissed";

export type AISuggestionType = "tag" | "collection" | "observation";

export interface AISuggestion {
  id: string;
  type: AISuggestionType;
  value: string;
  explanation: string;
}

export interface AITagSuggestion {
  id: string;
  tag: string;
  explanation: string;
}

export interface AIQualityObservation {
  id: string;
  text: string;
  explanation: string;
}

export interface AIProductionSuggestionDetail {
  recommendation: AIProductionSuggestion;
  summary: string;
  explanation: string;
}

export interface AIAnalysis {
  summary: string;
  strengths: string[];
  potentialIssues: string[];
  suggestedTags: AITagSuggestion[];
  suggestedCollectionId: string;
  suggestedCollectionExplanation: string;
  productionSuggestion: AIProductionSuggestionDetail;
  observations: AIQualityObservation[];
  confidence: AIConfidenceLevel;
  generatedAt: string;
}

export interface CuratorFeedbackEntry {
  id: string;
  assetId: string;
  suggestionType: AISuggestionType;
  suggestion: string;
  curatorAction: CuratorFeedbackAction;
  finalValue?: string;
  timestamp: string;
}

export interface AssetAISessionState {
  dismissedTagIds: string[];
  dismissedObservationIds: string[];
  aiAssistedReview: boolean;
}

export interface AIComparisonSummary {
  assetAStrengths: string[];
  assetBStrengths: string[];
  keyDifferences: string[];
  potentialConcerns: string[];
  suggestedDirection: string;
  explanation: string;
}

export interface AIAssistanceStats {
  suggestionsTotal: number;
  accepted: number;
  edited: number;
  dismissed: number;
  aiAssistedReviews: number;
}
