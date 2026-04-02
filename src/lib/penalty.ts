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
 * 취소 시 패널티 대상인지 확인 (해당 주 화요일 18:00 KST 이후)
 * 모임 날짜 기준으로 같은 주 화요일 18시 이후 취소 시 패널티 부과
 */
export function shouldApplyPenalty(meetingDate: string): boolean {
  const [year, month, day] = meetingDate.split("-").map(Number);

  // 모임 날짜의 요일 계산 (UTC 기준, 0=일, 1=월, 2=화, ..., 6=토)
  const meetingUTC = Date.UTC(year, month - 1, day);
  const meetingDayOfWeek = new Date(meetingUTC).getUTCDay();

  // 해당 주 화요일(2)까지 며칠 전인지 계산
  // 화=0, 수=1, 목=2, 금=3, 토=4, 일=5, 월=6 (화요일 기준)
  const daysToTuesday = meetingDayOfWeek >= 2 ? meetingDayOfWeek - 2 : meetingDayOfWeek + 5;

  // 화요일 자정 UTC
  const tuesdayUTCMidnight = meetingUTC - daysToTuesday * 24 * 60 * 60 * 1000;

  // 화요일 18:00 KST = 화요일 09:00 UTC
  const tuesdayCutoffUTC = tuesdayUTCMidnight + 9 * 60 * 60 * 1000;

  return Date.now() >= tuesdayCutoffUTC;
}

export const DEFAULT_PENALTY_MESSAGE =
  "화요일 18시 이후 취소로 패널티가 부과됩니다. 잦은 직전 취소는 다른 회원들에게 피해를 줄 수 있으니 신중하게 결정해 주세요.";
