import type { InstalmentStatus, PlanStatus } from "@/lib/db";

const NEUTRAL = "bg-edge/60 text-body";
const PENDING = "bg-pending-pale text-pending";
const ACTIVE = "bg-accent-pale text-accent-ink";
const DANGER = "bg-danger-pale text-danger";

const PLAN: Record<PlanStatus, [label: string, className: string]> = {
  draft: ["Awaiting bank details", PENDING],
  active: ["Active", ACTIVE],
  paused: ["On hold", PENDING],
  completed: ["Paid off", NEUTRAL],
  cancelled: ["Cancelled", NEUTRAL],
  failed: ["Needs bank details", DANGER],
};

const INSTALMENT: Record<InstalmentStatus, [label: string, className: string]> = {
  scheduled: ["Scheduled", NEUTRAL],
  processing: ["Processing", PENDING],
  paid: ["Paid", ACTIVE],
  failed: ["Failed", DANGER],
  cancelled: ["Not collected", NEUTRAL],
};

function Chip({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}

export function PlanStatusChip({ status }: { status: PlanStatus }) {
  const [label, className] = PLAN[status];
  return <Chip label={label} className={className} />;
}

export function InstalmentStatusChip({ status }: { status: InstalmentStatus }) {
  const [label, className] = INSTALMENT[status];
  return <Chip label={label} className={className} />;
}
