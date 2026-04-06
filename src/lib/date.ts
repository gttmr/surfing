const SEOUL_TIME_ZONE = "Asia/Seoul";

export function getTodayInSeoul(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: SEOUL_TIME_ZONE }).format(date);
}
