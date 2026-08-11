import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
}

export function PlaceholderPage({
  title,
  description,
  primaryHref = "/assets",
  primaryLabel = "Browse Asset Library",
}: PlaceholderPageProps) {
  return (
    <AppShell title={title} description={description}>
      <Card className="max-w-lg">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Coming in a future phase
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            This section is a navigation placeholder. Phase 1 focuses on the Dashboard and Asset Library.
          </p>
          <Link href={primaryHref} className="mt-6 inline-block">
            <Button variant="secondary">{primaryLabel}</Button>
          </Link>
        </CardContent>
      </Card>
    </AppShell>
  );
}
