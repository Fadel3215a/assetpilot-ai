import { Suspense } from "react";
import { ProductionReadyPage } from "@/components/production-ready-page";

export default function ProductionReadyRoute() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Loading...</div>}>
      <ProductionReadyPage />
    </Suspense>
  );
}
