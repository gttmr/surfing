"use client";

import Image from "next/image";
import Link from "next/link";
import { pickSurfAvatarEmoji } from "@/lib/avatar-emoji";
import type { MeetingWithCounts } from "@/lib/types";
import type {
  HomeUser,
  NoticeItem,
  SettlementAccount,
  SettlementSummary,
} from "@/lib/landing-types";
import { formatWon } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";

export type CalendarCell = {
  day: number;
  date: string;
  inCurrentMonth: boolean;
};

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
      settlement: SettlementSummary;
    };


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
    <Link href="/profile" className="flex items-center">
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
      <div className="mx-auto flex h-16 w-full max-w-[390px] items-center justify-between px-4">
        <div className="flex h-12 items-center">
          <Image alt="Surfing club logo" className="h-auto w-[64px]" height={64} priority src="/logo.png" width={64} />
        </div>
        <div className="flex items-center gap-2">
          {hasAlertCenter ? (
            <button
              aria-label="알림 센터 열기"
              className={`relative flex h-9 w-9 items-center justify-center transition-colors ${
                isAlertCenterOpen ? "text-[var(--brand-primary-text)]" : "text-[var(--brand-text-subtle)]"
              }`}
              onClick={onOpenAlertCenter}
              type="button"
            >
              <NoticeGlyph className="h-5 w-5" />
              {hasUnreadAlerts ? <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-[var(--brand-primary)]" /> : null}
            </button>
          ) : null}
          {user ? <ProfileButton user={user} /> : null}
        </div>
      </div>
    </header>
  );
}

type AlertCenterProps = {
  open: boolean;
  alertItems: AlertItem[];
  expandedAlertKey: string | null;
  settlementAccount: SettlementAccount | null;
  onClose: () => void;
  onToggleItem: (item: AlertItem) => void;
  onOpenTossTransfer: (meetingId: number, amount?: number) => void;
  onCopySettlementAccount: (meetingId: number) => void;
  onToggleSettlementCompleted: (meetingId: number, completed: boolean) => void;
};

export function AlertCenterModal({
  open,
  alertItems,
  expandedAlertKey,
  settlementAccount,
  onClose,
  onToggleItem,
  onOpenTossTransfer,
  onCopySettlementAccount,
  onToggleSettlementCompleted,
}: AlertCenterProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--brand-overlay)] px-4 py-6" onClick={onClose}>
      <div
        className="brand-card-soft mx-auto mt-20 w-full max-w-[390px] rounded-3xl p-5 shadow-[0_20px_48px_rgba(0,29,110,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-[var(--brand-text)]">알림 센터</p>
            <p className="brand-text-subtle mt-0.5 text-xs">공지사항과 정산 알림을 확인하세요.</p>
          </div>
          <button
            aria-label="알림 센터 닫기"
            className="brand-button-secondary flex h-9 w-9 items-center justify-center rounded-full"
            onClick={onClose}
            type="button"
          >
            <Icon className="text-[18px]" name="close" />
          </button>
        </div>

        <div className="space-y-3">
          {alertItems.length === 0 ? (
            <div className="brand-panel-white rounded-2xl px-4 py-8 text-center text-sm brand-text-subtle">
              현재 확인할 알림이 없습니다.
            </div>
          ) : (
            alertItems.map((item) => {
              const expanded = expandedAlertKey === item.key;

              return (
                <div key={item.key} className="border-b border-[var(--brand-divider)] last:border-b-0">
                  <button
                    className="flex w-full items-center gap-3 px-0 py-4 text-left"
                    onClick={() => onToggleItem(item)}
                    type="button"
                  >
                    <span className="shrink-0 text-lg leading-none">{item.type === "settlement" ? "💸" : "📣"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-[var(--brand-text)]">{item.title}</p>
                        {item.unread ? (
                          <span className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
                        ) : (
                          <span className="brand-text-subtle text-[11px] font-semibold">확인함</span>
                        )}
                      </div>
                      <p className="brand-text-subtle mt-1 text-xs">{item.subtitle}</p>
                    </div>
                    <Icon className={`text-[18px] transition-transform ${expanded ? "rotate-180" : ""}`} name="expand_more" />
                  </button>

                  {expanded ? (
                    <div className="border-t border-[var(--brand-divider)] px-0 py-4">
                      {item.type === "notice" ? (
                        <div className="space-y-2">
                          <p className="text-base font-bold text-[var(--brand-text)]">{item.notice.title}</p>
                          <p className="brand-text-muted whitespace-pre-line text-sm leading-6">{item.notice.body}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <p className="brand-text-subtle text-xs font-bold uppercase tracking-[0.24em]">총 비용</p>
                            <p className="mt-2 text-[1.8rem] font-headline font-extrabold leading-none tracking-[-0.04em] text-[var(--brand-text)]">
                              {formatWon(item.settlement.group.totalFee)}
                            </p>
                          </div>

                          {settlementAccount?.accountNumber ? (
                            <>
                              <div className="brand-text-muted text-xs">
                                {settlementAccount.bankName} {settlementAccount.accountNumber}
                                {settlementAccount.accountHolder ? ` · 예금주 ${settlementAccount.accountHolder}` : ""}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="brand-button-primary rounded-xl px-4 py-2.5 text-sm font-bold"
                                  onClick={() => onOpenTossTransfer(item.settlement.meeting.id, item.settlement.group.totalFee)}
                                  type="button"
                                >
                                  토스로 송금
                                </button>
                                <button
                                  className="brand-button-secondary rounded-xl px-4 py-2.5 text-sm font-bold"
                                  onClick={() => onCopySettlementAccount(item.settlement.meeting.id)}
                                  type="button"
                                >
                                  계좌번호 복사
                                </button>
                                <button
                                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                                    item.settlement.isCompleted
                                      ? "brand-panel-white border border-[var(--brand-divider)] text-[var(--brand-text-subtle)]"
                                      : "brand-button-primary"
                                  }`}
                                  onClick={() =>
                                    onToggleSettlementCompleted(
                                      item.settlement.meeting.id,
                                      !item.settlement.isCompleted
                                    )
                                  }
                                  type="button"
                                >
                                  {item.settlement.isCompleted ? "송금완료됨" : "송금완료"}
                                </button>
                              </div>
                            </>
                          ) : null}

                          <div className="brand-list-item rounded-2xl p-4">
                            <p className="brand-text-subtle text-[11px] font-bold uppercase tracking-[0.24em]">트립 정보</p>
                            <p className="mt-2 text-sm font-bold text-[var(--brand-text)]">{item.settlement.meeting.date}</p>
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
      </div>
    </div>
  );
}

export function CalendarSection({
  year,
  month,
  monthLabel,
  calendarCells,
  selectedDate,
  today,
  meetingsByDate,
  onMoveMonth,
  onSelectDate,
}: {
  year: number;
  month: number;
  monthLabel: string;
  calendarCells: CalendarCell[];
  selectedDate: string | null;
  today: string;
  meetingsByDate: Record<string, MeetingWithCounts[]>;
  onMoveMonth: (direction: -1 | 1) => void;
  onSelectDate: (date: string | null) => void;
}) {
  return (
    <section>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-headline text-[2.25rem] font-extrabold leading-none tracking-[-0.06em]">{monthLabel}</h1>
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

      <div className="brand-card-soft overflow-visible rounded-xl p-5">
        <div className="grid grid-cols-7 gap-y-4 text-center">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div
              key={day + index}
              className="text-[10px] font-bold uppercase tracking-[0.32em]"
              style={{ color: index === 0 ? "#ef4444" : index === 6 ? "#2563eb" : "var(--brand-text-subtle)" }}
            >
              {day}
            </div>
          ))}

          {calendarCells.map((cell) => {
            const isSelected = cell.date === selectedDate;
            const isToday = cell.date === today;
            const dayMeetings = meetingsByDate[cell.date] ?? [];
            const hasMeeting = dayMeetings.length > 0;
            const dateObj = new Date(`${cell.date}T00:00:00`);
            const dow = dateObj.getDay();

            return (
              <button
                key={cell.date}
                className="relative flex min-h-10 flex-col items-center justify-center"
                onClick={() => onSelectDate(cell.date === selectedDate ? null : cell.date)}
                type="button"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-[var(--brand-primary)] font-bold text-[var(--brand-primary-foreground)]"
                      : isToday
                        ? "bg-[var(--brand-primary-soft-strong)] font-bold text-[var(--brand-primary-text)]"
                        : cell.inCurrentMonth
                          ? dow === 0
                            ? "text-red-500"
                            : dow === 6
                              ? "text-blue-500"
                              : "text-[var(--brand-text)]"
                          : "text-[var(--brand-text-subtle)]"
                  }`}
                >
                  {cell.day}
                </div>
                {hasMeeting ? (
                  <div className={`absolute -bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-[var(--brand-primary-text)]" : "bg-[var(--brand-primary-border-strong)]"}`} />
                ) : null}
              </button>
            );
          })}
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
  onChange,
}: {
  activeTab: "apply" | "status" | "settlement";
  participantBadge: string;
  settlementBadge?: string;
  showSettlementTab: boolean;
  onChange: (tab: "apply" | "status" | "settlement") => void;
}) {
  return (
    <section>
      <div className="brand-tab-bar flex items-end">
        <button
          className={`flex-1 border-b-2 px-0 pb-3 text-base font-extrabold transition-colors ${
            activeTab === "apply" ? "brand-tab-underline-active" : "brand-tab-underline-inactive"
          }`}
          onClick={() => onChange("apply")}
          type="button"
        >
          참가하기
        </button>
        <button
          className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-0 pb-3 text-base font-extrabold transition-colors ${
            activeTab === "status" ? "brand-tab-underline-active" : "brand-tab-underline-inactive"
          }`}
          onClick={() => onChange("status")}
          type="button"
        >
          신청 현황
          <span className="brand-chip-dark flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold">
            {participantBadge}
          </span>
        </button>
        {showSettlementTab ? (
          <button
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-0 pb-3 text-base font-extrabold transition-colors ${
              activeTab === "settlement" ? "brand-tab-underline-active" : "brand-tab-underline-inactive"
            }`}
            onClick={() => onChange("settlement")}
            type="button"
          >
            정산 현황
            <span className="brand-chip-soft flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold">
              {settlementBadge ?? "0"}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
