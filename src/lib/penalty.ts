const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 일정 날짜까지 남은 일수를 계산 (KST 기준)
 */
export function getDaysUntilMeeting(meetingDate: string): number {
  const [year, month, day] = meetingDate.split("-").map(Number);
  const meetingUtc = Date.UTC(year, month - 1, day);

  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const todayUtc = Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate());

  return Math.floor((meetingUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

/**
 * 취소 시 패널티 대상인지 확인 (2일 이내)
 */
export function shouldApplyPenalty(meetingDate: string, penaltyDays: number = 2): boolean {
  const daysUntil = getDaysUntilMeeting(meetingDate);
  return daysUntil <= penaltyDays;
}

export const DEFAULT_PENALTY_MESSAGE =
  "일정 2일 이내 취소로 패널티가 부과됩니다. 잦은 직전 취소는 다른 회원들에게 피해를 줄 수 있으니 신중하게 결정해 주세요.";
