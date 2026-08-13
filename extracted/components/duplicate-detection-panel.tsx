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
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Metadata-based duplicate detection — not visual or AI similarity.
        </p>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No possible duplicates detected from current metadata.
          </p>
        ) : (
          <ul className="space-y-4">
            {candidates.map((candidate) => (
              <li
                key={candidate.id}
                className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Possible duplicate: &ldquo;{candidate.candidateName}&rdquo;
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{candidate.reason}</p>
                <ul className="mt-2 list-inside list-disc text-xs text-zinc-500 dark:text-zinc-400">
                  {candidate.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/assets/${candidate.candidateAssetId}`}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Review
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
