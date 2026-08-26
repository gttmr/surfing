"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { pickSurfAvatarEmoji } from "@/lib/avatar-emoji";
import type { MeetingWithCounts } from "@/lib/types";
import type {
  HomeUser,
  NoticeItem,
  SettlementSummary,
  UserNotificationItem,
} from "@/lib/landing-types";
import { formatWon } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs } from "@/components/ui/Tabs";
import { formatCalendarDateLabel, moveCalendarDate, type CalendarCell, type CalendarNavigationKey } from "@/lib/home-view";

export type { CalendarCell };

export type AlertItem =
  | {
      key: string;
      type: "notice";
      title: string;
      subtitle: string;
      unread: boolean;
      notice: NoticeItem;
    }
  | {
      key: string;
      type: "settlement";
      title: string;
      subtitle: string;
      unread: boolean;
      settlementStatus: "pending" | "in_progress" | "completed";
      settlement: SettlementSummary;
    }
  | {
      key: string;
      type: "order_cancelled";
      title: string;
      subtitle: string;
      unread: boolean;
      notification: UserNotificationItem;
    };

const BILLING_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
});


function NoticeGlyph({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4.25a4 4 0 0 0-4 4v1.18c0 .8-.24 1.58-.69 2.24L6.2 13.3a1.75 1.75 0 0 0 1.45 2.74h8.7a1.75 1.75 0 0 0 1.45-2.74l-1.11-1.63A3.95 3.95 0 0 1 16 9.43V8.25a4 4 0 0 0-4-4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}


function formatSettlementReasons(settlement: SettlementSummary) {
  const reasons = new Set<string>();

  for (const item of settlement.group.items) {
    if (item.baseFee > 0) reasons.add("참가비");
    if (item.lessonFee > 0) reasons.add("강습비");
    if (item.rentalFee > 0) reasons.add("장비 대여비");
    if (item.surfUsageLines?.length) reasons.add("실제 이용");
    if (item.foodSubtotal > 0) reasons.add("식음료");
    for (const adjustment of item.adjustments) {
      reasons.add(adjustment.label);
    }
  }

  return Array.from(reasons).join(", ");
}

function ProfileButton({ user }: { user: HomeUser }) {
  const hasImage = !!user.profileImage;
  const fallbackEmoji = pickSurfAvatarEmoji(user.kakaoId ?? user.nickname);

  return (
    <Link href="/profile" className="flex min-h-11 min-w-11 items-center justify-center">
      <span className="sr-only">프로필</span>
      <div className="brand-avatar-shell flex h-10 w-10 items-center justify-center overflow-hidden rounded-full shadow-sm">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={user.nickname} className="h-full w-full object-cover" referrerPolicy="no-referrer" src={user.profileImage} />
        ) : (
          <span className="text-sm font-extrabold">{fallbackEmoji}</span>
        )}
      </div>
    </Link>
  );
}

export function LandingHeader({
  user,
  hasAlertCenter,
  isAlertCenterOpen,
  hasUnreadAlerts,
  onOpenAlertCenter,
}: {
  user: HomeUser | null;
  hasAlertCenter: boolean;
  isAlertCenterOpen: boolean;
  hasUnreadAlerts: boolean;
  onOpenAlertCenter: () => void;
}) {
  return (
    <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-16 w-full max-w-[430px] items-center justify-between px-4">
        <Link aria-label="모임 달력 홈으로 이동" className="brand-touch-target flex h-12 items-center" href="/">
          <Image alt="SDS Surfing logo" className="h-auto w-[78px]" height={716} priority src="/logo.png" width={1148} />
        </Link>
        <div className="flex items-center gap-2">
          {hasAlertCenter ? (
            <button
              aria-label="알림 센터 열기"
              className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                isAlertCenterOpen ? "text-brand-primary-text" : "text-brand-text-subtle"
              }`}
              onClick={onOpenAlertCenter}
              type="button"
            >
              <NoticeGlyph className="h-5 w-5" />
              {hasUnreadAlerts ? <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-brand-primary" /> : null}
            </button>
          ) : null}
          {user ? <ProfileButton user={user} /> : null}
        </div>
      </div>
    </header>
  );
}

export function PendingBillingAlert({
  settlements,
}: {
  settlements: readonly SettlementSummary[];
}) {
  if (settlements.length === 0) return null;

  const requiresPayment = settlements.some((settlement) => settlement.paymentStatus === "PAYMENT_REQUIRED");
  const totalFee = settlements.reduce((sum, settlement) => sum + settlement.group.totalFee, 0);
  const singleSettlement = settlements.length === 1 ? settlements[0] : null;
  const title = requiresPayment
    ? settlements.length === 1
      ? "입금이 필요한 청구가 있습니다"
      : `확인할 청구 ${settlements.length}건이 있습니다`
    : "입금 확인을 기다리고 있습니다";
  const summary = singleSettlement
    ? `${BILLING_DATE_FORMATTER.format(new Date(`${singleSettlement.meeting.date}T12:00:00`))} 모임 · ${formatWon(singleSettlement.group.totalFee)}`
    : `${settlements.length}건 · 총 ${formatWon(totalFee)}`;

  return (
    <section
      aria-labelledby="pending-billing-title"
      className={`${requiresPayment ? "brand-alert-error" : "brand-alert-info"} rounded-2xl px-4 py-4`}
      role={requiresPayment ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        <span className={`${requiresPayment ? "brand-chip-danger" : "brand-chip-strong"} flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl`}>
          <Icon className="text-[22px]" name={requiresPayment ? "priority_high" : "schedule"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">지금 처리할 청구</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-[-0.03em] text-brand-text" id="pending-billing-title">
            {title}
          </h2>
          <p className="mt-2 text-sm font-bold">{summary}</p>
          <p className="mt-1 text-xs leading-5">
            {requiresPayment
              ? "모임 비용이 확정되었습니다. 오늘 입금해 주세요."
              : "입금 알림을 보냈습니다. 운영진이 확인하면 이 알림은 사라집니다."}
          </p>
        </div>
      </div>
      <Link className="brand-button-primary mt-4 flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-bold" href="/settlement">
        {requiresPayment ? "청구 확인하고 입금하기" : "입금 확인 상태 보기"}
      </Link>
    </section>
  );
}

type AlertCenterProps = {
  open: boolean;
  alertItems: AlertItem[];
  expandedAlertKey: string | null;
  onClose: () => void;
  onToggleItem: (item: AlertItem) => void;
};

export function AlertCenterModal({
  open,
  alertItems,
  expandedAlertKey,
  onClose,
  onToggleItem,
}: AlertCenterProps) {
  return (
    <Dialog
      closeLabel="알림 센터 닫기"
      description="공지사항과 청구·입금 알림을 확인하세요."
      onClose={onClose}
      open={open}
      title="알림 센터"
    >
        <div className="space-y-3">
          {alertItems.length === 0 ? (
            <div className="brand-panel-white rounded-2xl px-4 py-8 text-center text-sm brand-text-subtle">
              현재 확인할 알림이 없습니다.
            </div>
          ) : (
            alertItems.map((item) => {
              const expanded = expandedAlertKey === item.key;

              return (
                <div key={item.key} className="border-b border-brand-divider last:border-b-0">
                  <button
                    className="flex w-full items-center gap-3 px-0 py-4 text-left"
                    onClick={() => onToggleItem(item)}
                    type="button"
                  >
                    <Icon
                      className="shrink-0 text-[20px]"
                      name={item.type === "settlement" ? "payments" : item.type === "order_cancelled" ? "cancel" : "notifications"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-brand-text">{item.title}</p>
                        {item.unread ? (
                          <span className="h-2 w-2 rounded-full bg-brand-primary" />
                        ) : (
                          <span className="brand-text-subtle text-[11px] font-semibold">확인함</span>
                        )}
                      </div>
                      <p className="brand-text-subtle mt-1 text-xs">{item.subtitle}</p>
                    </div>
                    <Icon className={`text-[18px] transition-transform ${expanded ? "rotate-180" : ""}`} name="expand_more" />
                  </button>

                  {expanded ? (
                    <div className="border-t border-brand-divider px-0 py-4">
                      {item.type === "notice" ? (
                        <div className="space-y-2">
                          <p className="text-base font-bold text-brand-text">{item.notice.title}</p>
                          <p className="brand-text-muted whitespace-pre-line text-sm leading-6">{item.notice.body}</p>
                        </div>
                      ) : item.type === "order_cancelled" ? (
                        <div className="space-y-2">
                          <p className="text-base font-bold text-brand-text">{item.notification.title}</p>
                          <p className="brand-text-muted whitespace-pre-line text-sm leading-6">{item.notification.body}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <div className="mb-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                  item.settlementStatus === "completed"
                                    ? "brand-chip-success"
                                    : item.settlementStatus === "in_progress"
                                      ? "brand-chip-strong"
                                      : "brand-chip-soft"
                                }`}
                              >
                                {item.settlementStatus === "completed"
                                  ? "입금 완료"
                                  : item.settlementStatus === "in_progress"
                                    ? "입금 확인 중"
                                    : "입금 필요"}
                              </span>
                            </div>
                            <p className="mt-2 text-[1.8rem] font-headline font-extrabold leading-none tracking-[-0.04em] text-brand-text">
                              {formatWon(item.settlement.group.totalFee)}
                            </p>
                          </div>

                          <Link className="brand-button-primary flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-bold" href="/settlement" onClick={onClose}>
                            청구 내역에서 확인
                          </Link>

                          <div className="brand-list-item rounded-2xl p-4">
                            <p className="brand-text-subtle text-[11px] font-bold uppercase tracking-[0.24em]">트립 정보</p>
                            <p className="mt-2 text-sm font-bold text-brand-text">{item.settlement.meeting.date}</p>
                            <p className="brand-text-muted mt-1 text-sm">{item.settlement.meeting.location}</p>
                            <p className="brand-text-muted mt-1 text-sm">
                              비용 발생 사유: {formatSettlementReasons(item.settlement) || "참가비"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
    </Dialog>
  );
}

export function CalendarSection({
  year,
  monthLabel,
  calendarCells,
  selectedDate,
  today,
  meetingsByDate,
  onMoveMonth,
  onSelectDate,
}: {
  year: number;
  monthLabel: string;
  calendarCells: CalendarCell[];
  selectedDate: string | null;
  today: string;
  meetingsByDate: Record<string, MeetingWithCounts[]>;
  onMoveMonth: (direction: -1 | 1) => void;
  onSelectDate: (date: string) => void;
}) {
  const dateRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const entryDate = selectedDate && calendarCells.some((cell) => cell.date === selectedDate)
    ? selectedDate
    : calendarCells.find((cell) => cell.date === today)?.date
      ?? calendarCells.find((cell) => cell.inCurrentMonth)?.date
      ?? calendarCells[0]?.date;

  function handleDateKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const keys: readonly CalendarNavigationKey[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
    if (!keys.includes(event.key as CalendarNavigationKey)) return;
    event.preventDefault();
    const nextDate = moveCalendarDate(date, event.key as CalendarNavigationKey);
    onSelectDate(nextDate);
    requestAnimationFrame(() => dateRefs.current[nextDate]?.focus());
  }

  return (
    <section aria-labelledby="meeting-calendar-title">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-headline text-[2.25rem] font-extrabold leading-none tracking-[-0.06em]" id="meeting-calendar-title">{monthLabel}</h1>
          <p className="brand-text-subtle mt-1 text-xs font-semibold">{year}</p>
        </div>
        <div className="flex gap-2">
          <button
            aria-label="이전 달"
            className="brand-panel flex h-10 w-10 items-center justify-center rounded-xl transition-transform active:scale-95"
            onClick={() => onMoveMonth(-1)}
            type="button"
          >
            <Icon className="text-[18px]" name="chevron_left" />
          </button>
          <button
            aria-label="다음 달"
            className="brand-panel flex h-10 w-10 items-center justify-center rounded-xl transition-transform active:scale-95"
            onClick={() => onMoveMonth(1)}
            type="button"
          >
            <Icon className="text-[18px]" name="chevron_right" />
          </button>
        </div>
      </div>

      <div className="brand-card-soft overflow-visible rounded-2xl p-4">
        <p className="sr-only" id="meeting-calendar-help">방향키로 하루 또는 한 주 이동하고, Home과 End로 주의 처음과 끝, Page Up과 Page Down으로 달을 이동합니다.</p>
        <div aria-describedby="meeting-calendar-help" aria-label={`${year}년 ${monthLabel} 모임 달력`} className="grid grid-cols-7 gap-y-2 text-center" role="grid">
          <div className="col-span-7 grid grid-cols-7" role="row">
            {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
              <div className="py-1 text-[11px] font-bold" key={day} role="columnheader" style={{ color: index === 0 ? "var(--brand-calendar-sun)" : index === 6 ? "var(--brand-calendar-sat)" : "var(--brand-text-subtle)" }}>
                {day}
              </div>
            ))}
          </div>

          {Array.from({ length: Math.ceil(calendarCells.length / 7) }, (_, weekIndex) => (
            <div className="col-span-7 grid grid-cols-7" key={`week-${weekIndex}`} role="row">
              {calendarCells.slice(weekIndex * 7, weekIndex * 7 + 7).map((cell) => {
                const isSelected = cell.date === selectedDate;
                const isToday = cell.date === today;
                const hasMeeting = (meetingsByDate[cell.date] ?? []).length > 0;
                const dow = new Date(`${cell.date}T12:00:00`).getDay();
                return (
                  <button
                    aria-label={formatCalendarDateLabel(cell.date, { selected: isSelected, today: isToday, hasMeeting })}
                    aria-selected={isSelected}
                    className="relative flex min-h-10 flex-col items-center justify-center"
                    data-calendar-date={cell.date}
                    key={cell.date}
                    onClick={() => onSelectDate(cell.date)}
                    onKeyDown={(event) => handleDateKeyDown(event, cell.date)}
                    ref={(node) => { dateRefs.current[cell.date] = node; }}
                    role="gridcell"
                    tabIndex={cell.date === entryDate ? 0 : -1}
                    type="button"
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${isSelected ? "bg-brand-primary font-bold text-brand-primary-foreground" : isToday ? "bg-brand-primary-soft-strong font-bold text-brand-primary-text" : cell.inCurrentMonth ? dow === 0 ? "text-brand-calendar-sun" : dow === 6 ? "text-brand-calendar-sat" : "text-brand-text" : "text-brand-text-subtle"}`}>
                      {cell.day}
                    </span>
                    {hasMeeting ? <span aria-hidden className={`absolute -bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-brand-primary-text" : "bg-brand-primary-border-strong"}`} /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MeetingTabs({
  activeTab,
  participantBadge,
  settlementBadge,
  showSettlementTab,
  settlementLabel = "모임 안내",
  onChange,
  children,
}: {
  activeTab: "apply" | "status" | "settlement";
  participantBadge: string;
  settlementBadge?: string;
  showSettlementTab: boolean;
  settlementLabel?: string;
  onChange: (tab: "apply" | "status" | "settlement") => void;
  children: ReactNode;
}) {
  const items = [
    { id: "apply" as const, label: "내 참가" },
    {
      id: "status" as const,
      label: (
        <span className="inline-flex items-center gap-2">
          참가자
          <span className="brand-chip-dark flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold">{participantBadge}</span>
        </span>
      ),
    },
    ...(showSettlementTab
      ? [{
          id: "settlement" as const,
          label: (
            <span className="inline-flex items-center gap-2">
              {settlementLabel}
              {settlementBadge !== undefined ? (
                <span className="brand-chip-soft flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold">{settlementBadge}</span>
              ) : null}
            </span>
          ),
        }]
      : []),
  ];

  return (
    <Tabs
      activeId={activeTab}
      items={items}
      label="모임 정보"
      onChange={onChange}
      panelClassName="pt-6"
      tabClassName="flex-1 px-0 pb-3 text-base font-extrabold"
    >
      {children}
    </Tabs>
  );
}
