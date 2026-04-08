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
