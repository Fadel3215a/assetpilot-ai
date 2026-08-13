export type VisualGridVariant = "featured" | "wide" | "standard";

/** Deliberate editorial grid rhythm — repeats every 7 items. */
export function getVisualGridVariant(index: number): VisualGridVariant {
  const pos = index % 7;
  if (pos === 0) return "featured";
  if (pos === 5) return "wide";
  return "standard";
}

export function getVisualGridClasses(variant: VisualGridVariant): string {
  switch (variant) {
    case "featured":
      return "sm:col-span-2 sm:row-span-2 xl:col-span-2 xl:row-span-2";
    case "wide":
      return "sm:col-span-2 xl:col-span-2";
    default:
      return "";
  }
}
