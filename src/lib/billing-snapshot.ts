import type {
  AdminSettlementData,
  AdminSettlementParticipant,
} from "@/lib/admin-page-data";
import type { SettlementRecipientGroup } from "@/lib/pricing";

// 청구 공개 시점에 회원별 금액을 고정해 둔 기록.
// 새 기록은 version 1 (1박이면 meeting.endDate 가 있다). version 2 는 1박을 날짜별 모임 두 개로
// 운영하던 때의 기록으로, 읽기만 한다.
export const BILLING_SNAPSHOT_VERSION = 1 as const;
export const LEGACY_OVERNIGHT_BILLING_SNAPSHOT_VERSION = 2 as const;

export type SingleMeetingBillingSnapshotPayload = {
  readonly version: typeof BILLING_SNAPSHOT_VERSION;
  readonly meeting: {
    readonly id: number;
    readonly date: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly location: string;
    readonly endDate?: string | null;
  };
  readonly participants: readonly AdminSettlementParticipant[];
  readonly recipients: readonly SettlementRecipientGroup[];
  readonly surfUsageSummary: AdminSettlementData["surfUsageSummary"];
};

export type LegacyOvernightBillingSnapshotPayload = Omit<SingleMeetingBillingSnapshotPayload, "version"> & {
  readonly version: typeof LEGACY_OVERNIGHT_BILLING_SNAPSHOT_VERSION;
  readonly overnightGroup: { readonly days: readonly { readonly date: string }[] };
};

export type MeetingBillingSnapshotPayload = SingleMeetingBillingSnapshotPayload | LegacyOvernightBillingSnapshotPayload;

export type MeetingBillingSnapshotTotals = {
  readonly memberChargeTotal: number;
  readonly shopPayableTotal: number;
  readonly foodPayableTotal: number;
  readonly clubSupportTotal: number;
};

export type MeetingBillingSnapshotSource = {
  readonly meeting: Pick<
    AdminSettlementData["meeting"],
    "id" | "date" | "startTime" | "endTime" | "location" | "endDate"
  >;
  readonly participants: AdminSettlementData["participants"];
  readonly recipients: AdminSettlementData["recipients"];
  readonly surfUsageSummary: AdminSettlementData["surfUsageSummary"];
};

export function buildMeetingBillingSnapshot(
  data: MeetingBillingSnapshotSource
): {
  readonly payload: MeetingBillingSnapshotPayload;
  readonly totals: MeetingBillingSnapshotTotals;
} {
  const recipients: SettlementRecipientGroup[] = data.recipients.map((recipient) => ({
    recipientKakaoId: recipient.recipientKakaoId,
    recipientName: recipient.recipientName,
    recipientType: recipient.recipientType,
    items: recipient.items,
    totalFee: recipient.totalFee,
  }));
  const foodPayableTotal = data.participants.reduce(
    (total, participant) => total + participant.breakdown.foodSubtotal,
    0
  );
  const foodSupportTotal = data.participants.reduce(
    (total, participant) => total + participant.breakdown.foodSupportApplied,
    0
  );

  const payload: SingleMeetingBillingSnapshotPayload = {
    version: BILLING_SNAPSHOT_VERSION,
    meeting: {
      id: data.meeting.id,
      date: data.meeting.date,
      startTime: data.meeting.startTime,
      endTime: data.meeting.endTime,
      location: data.meeting.location,
      endDate: data.meeting.endDate,
    },
    participants: data.participants,
    recipients,
    surfUsageSummary: data.surfUsageSummary,
  };

  return {
    payload,
    totals: {
      memberChargeTotal: recipients.reduce((total, recipient) => total + recipient.totalFee, 0),
      shopPayableTotal: data.surfUsageSummary.shopChargeAmount,
      foodPayableTotal,
      clubSupportTotal: data.surfUsageSummary.operationsCoveredAmount + foodSupportTotal,
    },
  };
}

export function isMeetingBillingSnapshotPayload(value: unknown): value is MeetingBillingSnapshotPayload {
  if (typeof value !== "object" || value === null) return false;
  if (!("version" in value) || (value.version !== BILLING_SNAPSHOT_VERSION && value.version !== LEGACY_OVERNIGHT_BILLING_SNAPSHOT_VERSION)) return false;
  if (!("meeting" in value) || typeof value.meeting !== "object" || value.meeting === null) return false;
  if (!("participants" in value) || !Array.isArray(value.participants)) return false;
  if (!("recipients" in value) || !Array.isArray(value.recipients)) return false;
  if (!("surfUsageSummary" in value) || typeof value.surfUsageSummary !== "object" || value.surfUsageSummary === null) return false;
  if (value.version === LEGACY_OVERNIGHT_BILLING_SNAPSHOT_VERSION) {
    if (!("overnightGroup" in value) || typeof value.overnightGroup !== "object" || value.overnightGroup === null) return false;
    if (!("days" in value.overnightGroup) || !Array.isArray(value.overnightGroup.days) || value.overnightGroup.days.length !== 2) return false;
  }
  return true;
}
