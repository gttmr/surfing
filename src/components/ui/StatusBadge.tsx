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
    className: "brand-alert-success",
    dot: "brand-status-dot-success",
  },
  WAITLISTED: {
    label: "대기자",
    className: "brand-alert-info",
    dot: "brand-status-dot-info",
  },
  CANCELLED: {
    label: "취소됨",
    className: "bg-[var(--brand-dimmed-surface)] text-[var(--brand-dimmed-text)] border border-[var(--brand-dimmed-border)]",
    dot: "brand-status-dot-dimmed",
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
