import type { ParticipantStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: ParticipantStatus;
  waitlistPosition?: number | null;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  ParticipantStatus,
  { label: string; className: string; dot: string }
> = {
  APPROVED: {
    label: "참가 확정",
    className: "bg-green-50 text-green-700 border border-green-200",
    dot: "bg-green-500",
  },
  WAITLISTED: {
    label: "대기자",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  CANCELLED: {
    label: "취소됨",
    className: "bg-slate-100 text-slate-500 border border-slate-200",
    dot: "bg-slate-400",
  },
};

export function StatusBadge({ status, waitlistPosition, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const label =
    status === "WAITLISTED" && waitlistPosition
      ? `대기 ${waitlistPosition}번째`
      : config.label;

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.className} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
}
