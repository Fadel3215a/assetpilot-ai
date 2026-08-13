import type { AssetStatus } from "@/types";
import { statusLabel } from "@/lib/utils";

const statusStyles: Record<AssetStatus, string> = {
  DRAFT: "bg-status-neutral-muted text-status-neutral border-border",
  IN_REVIEW: "bg-status-warning-muted text-status-warning border-status-warning/20",
  CHANGES_REQUESTED: "bg-status-warning-muted text-status-warning border-status-warning/20",
  APPROVED: "bg-status-success-muted text-status-success border-status-success/20",
  REJECTED: "bg-status-danger-muted text-status-danger border-status-danger/20",
  PRODUCTION_READY: "bg-status-success-muted text-status-success border-status-success/20",
};

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${statusStyles[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
