import type {
  AdminSettlementData,
  AdminSettlementParticipant,
} from "@/lib/admin-page-data";
import type { SettlementRecipientGroup } from "@/lib/pricing";
import type { OvernightMeetingGroupSummary } from "@/lib/meeting-group";

export const BILLING_SNAPSHOT_VERSION = 1 as const;
export const OVERNIGHT_BILLING_SNAPSHOT_VERSION = 2 as const;

export type SingleMeetingBillingSnapshotPayload = {
  readonly version: typeof BILLING_SNAPSHOT_VERSION;
  readonly meeting: {
    readonly id: number;
    readonly date: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly location: string;
  };
  readonly participants: readonly AdminSettlementParticipant[];
  readonly recipients: readonly SettlementRecipientGroup[];
  readonly surfUsageSummary: AdminSettlementData["surfUsageSummary"];
};

export type OvernightMeetingBillingSnapshotPayload = Omit<SingleMeetingBillingSnapshotPayload, "version"> & {
  readonly version: typeof OVERNIGHT_BILLING_SNAPSHOT_VERSION;
  readonly overnightGroup: OvernightMeetingGroupSummary;
};

export type MeetingBillingSnapshotPayload = SingleMeetingBillingSnapshotPayload | OvernightMeetingBillingSnapshotPayload;

export type MeetingBillingSnapshotTotals = {
  readonly memberChargeTotal: number;
  readonly shopPayableTotal: number;
  readonly foodPayableTotal: number;
  readonly clubSupportTotal: number;
};

export type MeetingBillingSnapshotSource = {
  readonly meeting: Pick<
    AdminSettlementData["meeting"],
    "id" | "date" | "startTime" | "endTime" | "location"
  > & { readonly overnightGroup?: OvernightMeetingGroupSummary | null };
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

  const commonPayload = {
      meeting: {
        id: data.meeting.id,
        date: data.meeting.date,
        startTime: data.meeting.startTime,
        endTime: data.meeting.endTime,
        location: data.meeting.location,
      },
      participants: data.participants,
      recipients,
      surfUsageSummary: data.surfUsageSummary,
  };
  const payload: MeetingBillingSnapshotPayload = data.meeting.overnightGroup
    ? {
        ...commonPayload,
        version: OVERNIGHT_BILLING_SNAPSHOT_VERSION,
        overnightGroup: data.meeting.overnightGroup,
      }
    : {
        ...commonPayload,
        version: BILLING_SNAPSHOT_VERSION,
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
  if (!("version" in value) || (value.version !== BILLING_SNAPSHOT_VERSION && value.version !== OVERNIGHT_BILLING_SNAPSHOT_VERSION)) return false;
  if (!("meeting" in value) || typeof value.meeting !== "object" || value.meeting === null) return false;
  if (!("participants" in value) || !Array.isArray(value.participants)) return false;
  if (!("recipients" in value) || !Array.isArray(value.recipients)) return false;
  if (!("surfUsageSummary" in value) || typeof value.surfUsageSummary !== "object" || value.surfUsageSummary === null) return false;
  if (value.version === OVERNIGHT_BILLING_SNAPSHOT_VERSION) {
    if (!("overnightGroup" in value) || typeof value.overnightGroup !== "object" || value.overnightGroup === null) return false;
    if (!("days" in value.overnightGroup) || !Array.isArray(value.overnightGroup.days) || value.overnightGroup.days.length !== 2) return false;
  }
  return true;
}
