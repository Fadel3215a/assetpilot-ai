import { Suspense } from "react";
import { ComparisonPage } from "@/components/comparison-page";

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading comparison...</div>}>
      <ComparisonPage />
    </Suspense>
  );
}
