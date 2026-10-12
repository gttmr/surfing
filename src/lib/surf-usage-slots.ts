// 실제 이용 입력 칸. 1박이면 같은 항목도 날짜마다 따로 센다. 회원·샵 화면이 함께 쓴다.

export function usageSlotKey(day: number, usageItemId: number): string {
  return `${day}:${usageItemId}`;
}

export function parseUsageSlotKey(key: string): { day: number; usageItemId: number } {
  const [day, usageItemId] = key.split(":").map(Number);
  return { day, usageItemId };
}

export function usageSlotKeys(
  days: readonly { readonly dayIndex: number }[],
  items: readonly { readonly id: number }[],
): string[] {
  return days.flatMap((day) => items.map((item) => usageSlotKey(day.dayIndex, item.id)));
}

/**
 * 기록이 있으면 기록대로, 아직 아무 기록이 없으면 날짜별 신청 내용(강습·장비 1개)으로 미리 채운다.
 */
export function buildUsageDraft(
  participant: {
    readonly submissionStatus: "missing" | "submitted" | "confirmed";
    readonly entries: readonly { readonly day: number; readonly usageItemId: number; readonly quantity: number }[];
    readonly requestedByDay: readonly (string | null)[];
  },
  days: readonly { readonly dayIndex: number }[],
  items: readonly { readonly id: number; readonly serviceType: string }[],
): Record<string, number> {
  const recorded = participant.submissionStatus !== "missing" || participant.entries.length > 0;
  return Object.fromEntries(days.flatMap((day) => items.map((item) => {
    const quantity = recorded
      ? participant.entries
        .filter((entry) => entry.day === day.dayIndex && entry.usageItemId === item.id)
        .reduce((total, entry) => total + entry.quantity, 0)
      : participant.requestedByDay[day.dayIndex - 1] === item.serviceType ? 1 : 0;
    return [usageSlotKey(day.dayIndex, item.id), quantity];
  })));
}

