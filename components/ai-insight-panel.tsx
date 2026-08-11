"use client";

import { useEffect } from "react";
import { useAssets } from "@/lib/assets-context";
import { productionSuggestionLabel } from "@/lib/generate-ai-analysis";
import { AIConfidence } from "./ai-confidence";
import { AICollectionSuggestion } from "./ai-collection-suggestion";
import { AIObservations } from "./ai-observations";
import { AITagSuggestions } from "./ai-tag-suggestions";
import { AIFeedbackHistory } from "./ai-feedback-history";
import { Card, CardContent, CardHeader } from "./ui/card";
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
      <Card className="border-violet-200 bg-violet-50/30 dark:border-violet-900/50 dark:bg-violet-950/10">
        <CardHeader className="border-b border-violet-100 dark:border-violet-900/30">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600 text-xs font-bold text-white">
              AI
            </span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                AI-Assisted Analysis
              </h3>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Simulated suggestions — not verified facts or real model inference
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Summary</p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{analysis.summary}</p>
          </div>

          {analysis.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Strengths</p>
              <ul className="mt-1 space-y-1">
                {analysis.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="text-emerald-500" aria-hidden="true">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.potentialIssues.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Potential Issues</p>
              <ul className="mt-1 space-y-1">
                {analysis.potentialIssues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="text-amber-500" aria-hidden="true">⚠</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Suggested Tags</p>
            <AITagSuggestions
              assetId={asset.id}
              suggestions={analysis.suggestedTags}
              dismissedIds={session.dismissedTagIds}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
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
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Production Suggestion</p>
            <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {productionSuggestionLabel(analysis.productionSuggestion.recommendation)}
            </p>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              {analysis.productionSuggestion.summary}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Why? {analysis.productionSuggestion.explanation}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">AI Observations</p>
            <AIObservations
              assetId={asset.id}
              observations={analysis.observations}
              dismissedIds={session.dismissedObservationIds}
            />
          </div>

          <AIConfidence level={analysis.confidence} />
        </CardContent>
      </Card>

      {assetFeedback.length > 0 && (
        <AIFeedbackHistory feedback={assetFeedback} />
      )}
    </div>
  );
}
