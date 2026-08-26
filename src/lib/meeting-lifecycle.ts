export const ATTENDANCE_STATUSES = ["PENDING", "ATTENDED", "ABSENT"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type MeetingWorkflowStage =
  | "RECRUITING"
  | "UPCOMING"
  | "ACTUALS_REVIEW"
  | "BILLING_REVIEW"
  | "PAYMENT_CONFIRMATION"
  | "FINAL_SETTLEMENT"
  | "COMPLETED";

export type ActualUsageReviewState = "WAITING" | "OPEN" | "LOCKED";

export type ActualUsageReviewAvailability = {
  readonly state: ActualUsageReviewState;
  readonly editable: boolean;
  readonly reason: string;
};

export type BillingReadinessCheckId =
  | "meeting-ended"
  | "registration-closed"
  | "attendance-resolved"
  | "food-resolved"
  | "usage-resolved"
  | "billing-reviewed";

export type BillingReadinessCheck = {
  readonly id: BillingReadinessCheckId;
  readonly label: string;
  readonly complete: boolean;
  readonly detail: string;
  readonly href?: string;
};

export type BillingReadinessInput = {
  readonly now?: Date;
  readonly meeting: {
    readonly id: number;
    readonly date: string;
    readonly endTime: string;
    readonly isOpen: boolean;
    readonly billingReviewConfirmedAt?: Date | string | null;
  };
  readonly participants: readonly {
    readonly id: number;
    readonly status: string;
    readonly attendanceStatus?: string | null;
  }[];
  readonly foodOrderItems: readonly {
    readonly quantity: number;
    readonly servedQuantity: number;
    readonly cancelledAt?: Date | string | null;
  }[];
  readonly usageSubmissions: readonly {
    readonly participantId: number;
    readonly status: string;
    readonly confirmedAt?: Date | string | null;
  }[];
};

export function asAttendanceStatus(value: string | null | undefined): AttendanceStatus {
  return ATTENDANCE_STATUSES.find((status) => status === value) ?? "PENDING";
}

function meetingBoundary(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
}

export function isMeetingEnded(date: string, endTime: string, now = new Date()): boolean {
  const boundary = meetingBoundary(date, endTime);
  return Number.isFinite(boundary.getTime()) && now.getTime() >= boundary.getTime();
}

export function getActualUsageReviewAvailability(input: {
  readonly date: string;
  readonly endTime: string;
  readonly billingReviewConfirmedAt?: Date | string | null;
  readonly billingPublishedAt?: Date | string | null;
  readonly settlementOpen?: boolean;
  readonly now?: Date;
}): ActualUsageReviewAvailability {
  if (!isMeetingEnded(input.date, input.endTime, input.now)) {
    return {
      state: "WAITING",
      editable: false,
      reason: "모임 종료 후 실제 이용을 확인할 수 있습니다.",
    };
  }

  if (input.billingReviewConfirmedAt || input.billingPublishedAt || input.settlementOpen) {
    return {
      state: "LOCKED",
      editable: false,
      reason: "청구 검토가 시작되어 실제 이용 내역이 잠겼습니다.",
    };
  }

  return {
    state: "OPEN",
    editable: true,
    reason: "참석자의 실제 이용 내역을 확인해 주세요.",
  };
}

export function getBillingReadiness(input: BillingReadinessInput): {
  readonly ready: boolean;
  readonly checks: readonly BillingReadinessCheck[];
} {
  const approvedParticipants = input.participants.filter((participant) => participant.status === "APPROVED");
  const unresolvedAttendance = approvedParticipants.filter(
    (participant) => asAttendanceStatus(participant.attendanceStatus) === "PENDING"
  );
  const attendedParticipantIds = new Set(
    approvedParticipants
      .filter((participant) => asAttendanceStatus(participant.attendanceStatus) === "ATTENDED")
      .map((participant) => participant.id)
  );
  const confirmedUsageParticipantIds = new Set(
    input.usageSubmissions
      .filter((submission) => submission.status === "CONFIRMED" || submission.confirmedAt)
      .map((submission) => submission.participantId)
  );
  const unresolvedUsageCount = Array.from(attendedParticipantIds)
    .filter((participantId) => !confirmedUsageParticipantIds.has(participantId))
    .length;
  const unresolvedFoodCount = input.foodOrderItems.filter((item) => (
    !item.cancelledAt && item.servedQuantity < item.quantity
  )).length;
  const ended = isMeetingEnded(input.meeting.date, input.meeting.endTime, input.now);

  const checks: BillingReadinessCheck[] = [
    {
      id: "meeting-ended",
      label: "모임 종료",
      complete: ended,
      detail: ended ? "모임 시간이 종료되었습니다." : "모임 종료 후 청구를 공개할 수 있습니다.",
    },
    {
      id: "registration-closed",
      label: "참가 신청 마감",
      complete: !input.meeting.isOpen,
      detail: input.meeting.isOpen ? "참가 신청을 먼저 마감해 주세요." : "참가 신청이 마감되었습니다.",
      href: `/admin/meetings/${input.meeting.id}#meeting-operations`,
    },
    {
      id: "attendance-resolved",
      label: "실제 참석 확인",
      complete: ended && unresolvedAttendance.length === 0,
      detail: !ended
        ? "모임 종료 후 참석 상태를 확인합니다."
        : unresolvedAttendance.length === 0
        ? `참가자 ${approvedParticipants.length}명의 참석 상태를 확인했습니다.`
        : `${unresolvedAttendance.length}명의 참석 여부를 확인해 주세요.`,
      href: `/admin/meetings/${input.meeting.id}#participants`,
    },
    {
      id: "food-resolved",
      label: "식음료 처리",
      complete: ended && unresolvedFoodCount === 0,
      detail: !ended
        ? "모임 종료 후 식음료 처리 상태를 확정합니다."
        : unresolvedFoodCount === 0
        ? "처리되지 않은 식음료 주문이 없습니다."
        : `식음료 주문 ${unresolvedFoodCount}건을 처리해 주세요.`,
      href: `/admin/meetings/${input.meeting.id}/orders`,
    },
    {
      id: "usage-resolved",
      label: "실제 이용 확인",
      complete: ended && unresolvedUsageCount === 0,
      detail: !ended
        ? "모임 종료 후 실제 이용 내역을 확인합니다."
        : unresolvedUsageCount === 0
        ? "참석자의 실제 이용 내역을 모두 확인했습니다."
        : `${unresolvedUsageCount}명의 실제 이용 내역을 확인해 주세요.`,
      href: `/shop/usage?meetingId=${input.meeting.id}`,
    },
    {
      id: "billing-reviewed",
      label: "청구 검토",
      complete: Boolean(input.meeting.billingReviewConfirmedAt),
      detail: input.meeting.billingReviewConfirmedAt
        ? "회원별 청구 금액 검토를 완료했습니다."
        : "회원별 청구 항목과 조정 금액을 검토해 주세요.",
    },
  ];

  return {
    ready: checks.every((check) => check.complete),
    checks,
  };
}

export function getMeetingWorkflowStage(input: {
  readonly date: string;
  readonly endTime: string;
  readonly isOpen: boolean;
  readonly settlementOpen: boolean;
  readonly billingEvidenceReady?: boolean;
  readonly recipientCount?: number;
  readonly verifiedRecipientCount?: number;
  readonly settlementCompletedAt?: Date | string | null;
  readonly now?: Date;
}): MeetingWorkflowStage {
  if (input.settlementCompletedAt) return "COMPLETED";

  if (input.settlementOpen) {
    const recipientCount = input.recipientCount ?? 0;
    const verifiedRecipientCount = input.verifiedRecipientCount ?? 0;
    return recipientCount > 0 && verifiedRecipientCount >= recipientCount
      ? "FINAL_SETTLEMENT"
      : "PAYMENT_CONFIRMATION";
  }

  if (!isMeetingEnded(input.date, input.endTime, input.now)) {
    return input.isOpen ? "RECRUITING" : "UPCOMING";
  }

  return input.billingEvidenceReady ? "BILLING_REVIEW" : "ACTUALS_REVIEW";
}

export const MEETING_WORKFLOW_LABELS: Record<MeetingWorkflowStage, string> = {
  RECRUITING: "모집 중",
  UPCOMING: "모임 예정",
  ACTUALS_REVIEW: "참석·이용 확인",
  BILLING_REVIEW: "청구 검토",
  PAYMENT_CONFIRMATION: "입금 확인",
  FINAL_SETTLEMENT: "최종 정산",
  COMPLETED: "정산 완료",
};
