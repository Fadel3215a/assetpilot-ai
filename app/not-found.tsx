import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AppShell
      title="Page not found"
      description="The requested resource could not be found in this demo workspace."
    >
      <div className="mx-auto max-w-md rounded-md border border-border bg-surface p-8 text-center">
        <p className="text-sm font-medium text-foreground">Asset or page not found</p>
        <p className="mt-2 text-sm text-muted">
          The link may be invalid, or the asset may have been removed when the session was reset.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/assets">
            <Button type="button">Return to Asset Library</Button>
          </Link>
          <Link href="/">
            <Button type="button" variant="secondary">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
