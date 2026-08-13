"use client";

import { useEffect } from "react";
import { useAssets } from "@/lib/assets-context";
import { productionSuggestionLabel } from "@/lib/generate-ai-analysis";
import { AIConfidence } from "./ai-confidence";
import { AICollectionSuggestion } from "./ai-collection-suggestion";
import { AIObservations } from "./ai-observations";
import { AITagSuggestions } from "./ai-tag-suggestions";
import { AIFeedbackHistory } from "./ai-feedback-history";
import { SourceBadge } from "./ui/source-badge";
import type { Asset } from "@/types";

interface AIInsightPanelProps {
  asset: Asset;
}

export function AIInsightPanel({ asset }: AIInsightPanelProps) {
  const { getAISession, markAIAssistedReview, getAssetFeedback, collections } = useAssets();
  const session = getAISession(asset.id);
  const analysis = asset.aiAnalysis;
  const assetFeedback = getAssetFeedback(asset.id);
  const collection = collections.find((c) => c.id === analysis.suggestedCollectionId);

  useEffect(() => {
    markAIAssistedReview(asset.id);
  }, [asset.id, markAIAssistedReview]);

  return (
    <div className="space-y-4">
      <div className="panel-ai">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <SourceBadge source="ai" />
          <div>
            <h3 className="section-title">AI-Assisted Analysis</h3>
            <p className="text-xs text-accent">
              Simulated AI analysis — suggestions only; human review required
            </p>
          </div>
        </div>
        <div className="space-y-5 px-4 py-4">
          <div>
            <p className="section-label">Summary</p>
            <p className="mt-1 text-sm text-foreground">{analysis.summary}</p>
          </div>

          {analysis.strengths.length > 0 && (
            <div>
              <p className="section-label">Strengths</p>
              <ul className="mt-1 space-y-1">
                {analysis.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-status-success" aria-hidden="true">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.potentialIssues.length > 0 && (
            <div>
              <p className="section-label">Potential Issues</p>
              <ul className="mt-1 space-y-1">
                {analysis.potentialIssues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-status-warning" aria-hidden="true">⚠</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="section-label mb-2">Suggested Tags</p>
            <AITagSuggestions
              assetId={asset.id}
              suggestions={analysis.suggestedTags}
              dismissedIds={session.dismissedTagIds}
            />
          </div>

          <div>
            <p className="section-label mb-2">
              Suggested Collection — {collection?.name}
            </p>
            <AICollectionSuggestion
              assetId={asset.id}
              suggestedCollectionId={analysis.suggestedCollectionId}
              explanation={analysis.suggestedCollectionExplanation}
              currentCollectionId={asset.collectionId}
            />
          </div>

          <div>
            <p className="section-label">Production Suggestion</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {productionSuggestionLabel(analysis.productionSuggestion.recommendation)}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {analysis.productionSuggestion.summary}
            </p>
            <p className="mt-1 text-xs text-muted">
              Why? {analysis.productionSuggestion.explanation}
            </p>
          </div>

          <div>
            <p className="section-label mb-2">AI Observations</p>
            <AIObservations
              assetId={asset.id}
              observations={analysis.observations}
              dismissedIds={session.dismissedObservationIds}
            />
          </div>

          <AIConfidence level={analysis.confidence} />
        </div>
      </div>

      {assetFeedback.length > 0 && (
        <AIFeedbackHistory feedback={assetFeedback} />
      )}
    </div>
  );
}
