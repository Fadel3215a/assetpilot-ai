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
        <h3 className="section-title">{title}</h3>
        <p className="mt-0.5 text-xs text-muted">
          Curator decisions with timestamps and reasons
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No decisions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {entry.decision.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted">
                      {statusLabel(entry.previousStatus)} → {statusLabel(entry.newStatus)}
                    </p>
                  </div>
                  <time className="text-xs text-muted" dateTime={entry.timestamp}>
                    {formatDate(entry.timestamp)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Curator: {entry.reviewer}
                  {entry.curatorScore !== undefined && ` · Score: ${entry.curatorScore}`}
                </p>
                {entry.reason && (
                  <p className="mt-1.5 rounded-md bg-surface-elevated p-2 text-sm text-muted">
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
