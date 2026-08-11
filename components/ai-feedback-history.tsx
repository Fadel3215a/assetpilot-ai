import { formatDate } from "@/lib/utils";
import type { CuratorFeedbackEntry } from "@/types";
import { Card, CardContent, CardHeader } from "./ui/card";

interface AIFeedbackHistoryProps {
  feedback: CuratorFeedbackEntry[];
  title?: string;
}

export function AIFeedbackHistory({ feedback, title = "Curator Feedback" }: AIFeedbackHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Human responses to AI suggestions — not model training
        </p>
      </CardHeader>
      <CardContent>
        {feedback.length === 0 ? (
          <p className="text-sm text-zinc-500">No feedback recorded yet this session.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {feedback.map((entry) => (
              <li key={entry.id} className="py-2.5 first:pt-0">
                <p className="text-sm">
                  <span className="font-medium capitalize">{entry.curatorAction}</span>
                  {" "}{entry.suggestionType}: &quot;{entry.suggestion}&quot;
                  {entry.finalValue && entry.finalValue !== entry.suggestion && (
                    <span className="text-zinc-500"> → &quot;{entry.finalValue}&quot;</span>
                  )}
                </p>
                <time className="text-xs text-zinc-400" dateTime={entry.timestamp}>
                  {formatDate(entry.timestamp)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
