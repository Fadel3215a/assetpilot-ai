import type { AssetStatus } from "@/types";
import { statusLabel } from "@/lib/utils";

const statusStyles: Record<AssetStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  IN_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CHANGES_REQUESTED: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  PRODUCTION_READY: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
};

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
