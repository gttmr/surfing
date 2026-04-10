export const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const MONTH_NAMES_KO = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
] as const;

export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatRelativeTimeKo(value: string | Date, now = new Date()): string {
  const target = value instanceof Date ? value : new Date(value);
  const diffMs = now.getTime() - target.getTime();

  if (!Number.isFinite(diffMs)) return "";

  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}
