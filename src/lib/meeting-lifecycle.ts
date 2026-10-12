import { lastMeetingDate } from "@/lib/meeting-days";

export type MeetingWorkflowStage =
  | "RECRUITING"
  | "UPCOMING"
  | "ACTUALS_REVIEW"
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
  | "food-resolved"
  | "usage-resolved";

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
    readonly endDate?: string | null;
    readonly endTime: string;
    /** 샵의 항목별 수량 확인. 청구를 막지는 않고 안내만 한다. */
    readonly shopUsageCheckedAt?: Date | string | null;
  };
  readonly participants: readonly {
    readonly id: number;
    readonly status: string;
    readonly absentAt?: Date | string | null;
    readonly usageConfirmedAt?: Date | string | null;
  }[];
  readonly foodOrderItems: readonly {
    readonly quantity: number;
    readonly servedQuantity: number;
    readonly cancelledAt?: Date | string | null;
  }[];
};

function meetingBoundary(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
}

export function isMeetingEnded(date: string, endTime: string, now = new Date()): boolean {
  const boundary = meetingBoundary(date, endTime);
  return Number.isFinite(boundary.getTime()) && now.getTime() >= boundary.getTime();
}

/** 일정이 모두 끝났는지 (1박은 마지막 날 종료 시각 기준) */
export function isMeetingScheduleEnded(
  meeting: { readonly date: string; readonly endDate?: string | null; readonly endTime: string },
  now = new Date(),
): boolean {
  return isMeetingEnded(lastMeetingDate(meeting), meeting.endTime, now);
}

export function getActualUsageReviewAvailability(input: {
  readonly date: string;
  readonly endDate?: string | null;
  readonly endTime: string;
  readonly billingPublishedAt?: Date | string | null;
  readonly now?: Date;
}): ActualUsageReviewAvailability {
  if (!isMeetingScheduleEnded(input, input.now)) {
    return {
      state: "WAITING",
      editable: false,
      reason: "모임 종료 후 실제 이용을 확인할 수 있습니다.",
    };
  }

  if (input.billingPublishedAt) {
    return {
      state: "LOCKED",
      editable: false,
      reason: "청구가 공개되어 실제 이용 내역이 잠겼습니다.",
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
  // 불참해도 참가비는 청구되므로 참석 확인은 청구 조건이 아니다.
  // 운영진이 불참으로 표시한 사람만 실제 이용 확인에서 제외한다.
  const unresolvedUsageCount = input.participants.filter((participant) => (
    participant.status === "APPROVED" && !participant.absentAt && !participant.usageConfirmedAt
  )).length;
  const unresolvedFoodCount = input.foodOrderItems.filter((item) => (
    !item.cancelledAt && item.servedQuantity < item.quantity
  )).length;
  const ended = isMeetingScheduleEnded(input.meeting, input.now);

  const checks: BillingReadinessCheck[] = [
    {
      id: "meeting-ended",
      label: "모임 종료",
      complete: ended,
      detail: ended ? "모임 시간이 종료되었습니다." : "모임 종료 후 청구를 공개할 수 있습니다.",
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
        ? input.meeting.shopUsageCheckedAt
          ? "실제 이용 내역을 모두 확인했고 샵도 수량을 확인했습니다."
          : "실제 이용 내역을 모두 확인했습니다. 샵 수량 확인은 아직입니다."
        : `${unresolvedUsageCount}명의 실제 이용 내역을 확인해 주세요.`,
      href: `/shop/usage?meetingId=${input.meeting.id}`,
    },
  ];

  return {
    ready: checks.every((check) => check.complete),
    checks,
  };
}

export function getMeetingWorkflowStage(input: {
  readonly date: string;
  readonly endDate?: string | null;
  readonly endTime: string;
  readonly isOpen: boolean;
  readonly billingPublished: boolean;
  readonly recipientCount?: number;
  readonly verifiedRecipientCount?: number;
  readonly settlementCompletedAt?: Date | string | null;
  readonly now?: Date;
}): MeetingWorkflowStage {
  if (input.settlementCompletedAt) return "COMPLETED";

  if (input.billingPublished) {
    const recipientCount = input.recipientCount ?? 0;
    const verifiedRecipientCount = input.verifiedRecipientCount ?? 0;
    return recipientCount > 0 && verifiedRecipientCount >= recipientCount
      ? "FINAL_SETTLEMENT"
      : "PAYMENT_CONFIRMATION";
  }

  if (!isMeetingScheduleEnded(input, input.now)) {
    return input.isOpen ? "RECRUITING" : "UPCOMING";
  }

  return "ACTUALS_REVIEW";
}

export const MEETING_WORKFLOW_LABELS: Record<MeetingWorkflowStage, string> = {
  RECRUITING: "모집 중",
  UPCOMING: "모임 예정",
  ACTUALS_REVIEW: "이용 확인",
  PAYMENT_CONFIRMATION: "입금 확인",
  FINAL_SETTLEMENT: "최종 정산",
  COMPLETED: "정산 완료",
};
