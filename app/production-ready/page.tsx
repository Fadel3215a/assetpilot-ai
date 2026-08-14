import { Suspense } from "react";
import { ProductionReadyPage } from "@/components/production-ready-page";

export default function ProductionReadyRoute() {
  return (
    <Suspense fallback={<div className="loading-fallback p-8 text-sm text-muted">Loading...</div>}>
      <ProductionReadyPage />
    </Suspense>
  );
}
