import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";

export type ShopUsageParticipant = ShopMeetingSurfUsageData["participantRows"][number];
export type ShopUsageStatus = ShopUsageParticipant["submissionStatus"];
export type ShopUsageFilter = "actionable" | ShopUsageStatus;
export type ShopUsageDrafts = Record<number, Record<number, number>>;
export type ShopUsageParticipantAction = "save" | "confirm";
export type ShopUsagePendingViewChange =
  | { readonly kind: "query"; readonly value: string }
  | { readonly kind: "filter"; readonly value: ShopUsageFilter }
  | { readonly kind: "open"; readonly value: number | null };
export type ShopUsageLockedParticipant = {
  readonly action: ShopUsageParticipantAction;
  readonly participantId: number;
};

export const SHOP_USAGE_ACTION_COPY = {
  save: { failure: "이용 내역을 저장하지 못했습니다.", success: "이용 내역을 저장했습니다." },
  confirm: { failure: "이용 내역을 확정하지 못했습니다.", success: "이용 내역을 확정했습니다." },
} as const satisfies Record<ShopUsageParticipantAction, { readonly failure: string; readonly success: string }>;

export const SHOP_USAGE_FILTERS: ReadonlyArray<{
  readonly value: ShopUsageFilter;
  readonly label: string;
}> = [
  { value: "missing", label: "미제출" },
  { value: "actionable", label: "확인 필요" },
  { value: "confirmed", label: "확정" },
];

export const SHOP_USAGE_STATUS_LABELS = {
  missing: "미제출",
  submitted: "확인 필요",
  confirmed: "확정",
} as const satisfies Record<ShopUsageStatus, string>;

export function buildShopUsageDrafts(data: ShopMeetingSurfUsageData): ShopUsageDrafts {
  return Object.fromEntries(
    data.participantRows.map((participant) => [
      participant.participantId,
      Object.fromEntries(
        data.usageItems.map((item) => [
          item.id,
          (() => {
            const submittedQuantity = participant.entries
              .filter((entry) => entry.usageItemId === item.id)
              .reduce((total, entry) => total + entry.quantity, 0);
            if (participant.submissionStatus !== "missing" || participant.entries.length > 0) return submittedQuantity;
            return participant.requestedServiceType === item.serviceType ? 1 : 0;
          })(),
        ]),
      ),
    ]),
  );
}

export function hasShopUsageVariance(participant: ShopUsageParticipant): boolean {
  if (participant.submissionStatus === "missing") return false;
  const expectedServiceType = participant.requestedServiceType
    ?? (participant.requestedOptionLabel === "강습+장비"
      ? "LESSON_PACKAGE"
      : participant.requestedOptionLabel === "장비만"
        ? "EQUIPMENT_RENTAL"
        : null);
  const actualEntries = participant.entries.filter((entry) => entry.quantity > 0);
  if (!expectedServiceType) return actualEntries.length > 0;
  return actualEntries.length !== 1
    || actualEntries[0].serviceType !== expectedServiceType
    || actualEntries[0].quantity !== 1;
}

function matchesFilter(participant: ShopUsageParticipant, filter: ShopUsageFilter): boolean {
  if (filter === "actionable") return participant.submissionStatus !== "confirmed";
  return participant.submissionStatus === filter;
}

function matchesQuery(participant: ShopUsageParticipant, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase("ko-KR");
  if (!query) return true;
  return [
    participant.participantName,
    participant.requestedOptionLabel,
    SHOP_USAGE_STATUS_LABELS[participant.submissionStatus],
  ].some((value) => value.toLocaleLowerCase("ko-KR").includes(query));
}

export function selectShopUsageParticipants(
  rows: readonly ShopUsageParticipant[],
  input: { readonly filter: ShopUsageFilter; readonly query: string },
): ShopUsageParticipant[] {
  return rows
    .filter((participant) => (
      matchesFilter(participant, input.filter) && matchesQuery(participant, input.query)
    ))
    .sort((left, right) => {
      const priority = (participant: ShopUsageParticipant) => {
        if (participant.submissionStatus === "submitted" && hasShopUsageVariance(participant)) return 0;
        if (participant.submissionStatus === "submitted") return 1;
        if (participant.submissionStatus === "missing") return 2;
        return 3;
      };
      return priority(left) - priority(right);
    });
}

export function isShopUsageDraftDirty(
  participantId: number,
  itemIds: readonly number[],
  savedDrafts: ShopUsageDrafts,
  localDrafts: ShopUsageDrafts,
): boolean {
  return itemIds.some((itemId) => (
    (savedDrafts[participantId]?.[itemId] ?? 0) !== (localDrafts[participantId]?.[itemId] ?? 0)
  ));
}

export function getDirtyShopUsageParticipantIds(
  participants: readonly ShopUsageParticipant[],
  itemIds: readonly number[],
  savedDrafts: ShopUsageDrafts,
  localDrafts: ShopUsageDrafts,
): number[] {
  return participants
    .filter((participant) => isShopUsageDraftDirty(
      participant.participantId,
      itemIds,
      savedDrafts,
      localDrafts,
    ))
    .map((participant) => participant.participantId);
}

export function getShopUsageFilterCount(
  rows: readonly ShopUsageParticipant[],
  filter: ShopUsageFilter,
): number {
  return rows.filter((participant) => matchesFilter(participant, filter)).length;
}
