"use client";

import Link from "next/link";
import { useAssets } from "@/lib/assets-context";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

interface DuplicateDetectionPanelProps {
  assetId: string;
}

export function DuplicateDetectionPanel({ assetId }: DuplicateDetectionPanelProps) {
  const { getDuplicateCandidates, ignoreDuplicate } = useAssets();
  const candidates = getDuplicateCandidates(assetId);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Possible Duplicates</h3>
        <p className="text-xs text-muted">
          Metadata-based duplicate detection — not visual or AI similarity.
        </p>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">
            No possible duplicates detected from current metadata.
          </p>
        ) : (
          <ul className="space-y-4">
            {candidates.map((candidate) => (
              <li
                key={candidate.id}
                className="rounded-md border border-status-warning/30 bg-status-warning-muted p-4"
              >
                <p className="text-sm font-medium text-foreground">
                  Possible duplicate: &ldquo;{candidate.candidateName}&rdquo;
                </p>
                <p className="mt-1 text-xs text-muted">{candidate.reason}</p>
                <ul className="mt-2 list-inside list-disc text-xs text-muted">
                  {candidate.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/assets/${candidate.candidateAssetId}`}>
                    <Button type="button" className="text-xs">
                      Review
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => ignoreDuplicate(candidate.id)}
                  >
                    Ignore
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
