import type { DecisionHistoryEntry } from "@/types";
import { formatDate, statusLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "./ui/card";

interface DecisionHistoryPanelProps {
  history: DecisionHistoryEntry[];
  title?: string;
  limit?: number;
}

export function DecisionHistoryPanel({
  history,
  title = "Decision History",
  limit,
}: DecisionHistoryPanelProps) {
  const entries = limit ? history.slice(0, limit) : history;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Curator decisions with timestamps and reasons
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No decisions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {entries.map((entry) => (
              <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {entry.decision.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {statusLabel(entry.previousStatus)} → {statusLabel(entry.newStatus)}
                    </p>
                  </div>
                  <time className="text-xs text-zinc-400 dark:text-zinc-500" dateTime={entry.timestamp}>
                    {formatDate(entry.timestamp)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Reviewer: {entry.reviewer}
                  {entry.curatorScore !== undefined && ` · Score: ${entry.curatorScore}`}
                </p>
                {entry.reason && (
                  <p className="mt-1.5 rounded-md bg-zinc-50 p-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {entry.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
