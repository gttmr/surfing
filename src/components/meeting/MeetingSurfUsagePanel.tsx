"use client";

import { useEffect, useState } from "react";
import type { ParticipantMeetingSurfUsageData } from "@/lib/surf-usage-data";
import { formatWon } from "@/lib/format";
import { buildUsageDraft, parseUsageSlotKey, usageSlotKey, usageSlotKeys } from "@/lib/surf-usage-slots";
import { Icon } from "@/components/ui/Icon";

/** 참가자별 → "날짜:항목" 별 수량 */
type DraftMap = Record<number, Record<string, number>>;
type ParticipantRow = ParticipantMeetingSurfUsageData["participants"][number];
type UsageItem = ParticipantMeetingSurfUsageData["usageItems"][number];

// 한 사람이 하루에 쓰는 강습·장비·슈트는 하나다. 하나를 고르면 같은 날의 다른 것은 꺼진다. 샤워 등은 따로 고른다.
const MAIN_SERVICE_TYPES = new Set<UsageItem["serviceType"]>(["LESSON_PACKAGE", "EQUIPMENT_RENTAL", "WETSUIT_ONLY"]);

function buildDrafts(data: ParticipantMeetingSurfUsageData): DraftMap {
  return Object.fromEntries(
    data.participants.map((participant) => [
      participant.participantId,
      buildUsageDraft(participant, data.meeting.days, data.usageItems),
    ])
  );
}

function getStatusLabel(status: ParticipantRow["submissionStatus"]) {
  if (status === "confirmed") return "샵 확인";
  if (status === "submitted") return "제출됨";
  return "미제출";
}

function getStatusChipClass(status: ParticipantRow["submissionStatus"]) {
  if (status === "confirmed") return "brand-chip-success";
  if (status === "submitted") return "brand-chip-soft";
  return "brand-chip-dimmed";
}

function getCollapsedSummary(participant: ParticipantRow, overnight: boolean): string {
  const totals = new Map<string, number>();
  for (const entry of participant.entries) {
    if (entry.quantity <= 0) continue;
    const label = overnight ? `${entry.day}일차 ${entry.usageItemName}` : entry.usageItemName;
    totals.set(label, (totals.get(label) ?? 0) + entry.quantity);
  }

  const summary = Array.from(totals.entries())
    .map(([name, quantity]) => `${name} ${quantity}`)
    .join(" · ");

  if (summary) return summary;
  if (participant.submissionStatus !== "missing") return "이용 없음";
  return participant.roleLabel;
}

export function MeetingSurfUsagePanel({ meetingId }: { meetingId: number }) {
  const [data, setData] = useState<ParticipantMeetingSurfUsageData | null>(null);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingParticipantId, setSavingParticipantId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/usage`);
        const next = await res.json();
        if (!res.ok) throw new Error(next.error || "이용 내역을 불러오지 못했습니다.");
        if (!active) return;
        const usageData = next as ParticipantMeetingSurfUsageData;
        setData(usageData);
        setDrafts(buildDrafts(usageData));
        setExpandedId(usageData.participants.find((participant) => participant.canSubmit)?.participantId ?? null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "이용 내역을 불러오지 못했습니다.");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [meetingId]);

  const participants = data?.participants ?? [];
  const days = data?.meeting.days ?? [];
  const overnight = days.length > 1;
  const slots = data ? days.flatMap((day) => data.usageItems.map((item) => ({ day, item, key: usageSlotKey(day.dayIndex, item.id) }))) : [];

  // 회원 화면은 사람별로 쓴 것만 고른다. 수량(+/-)을 두면 미리 채운 1에 더해 2가 되는 일이 생긴다.
  function toggleSlot(participantId: number, dayIndex: number, item: UsageItem) {
    setDrafts((prev) => {
      const current = prev[participantId] ?? {};
      const key = usageSlotKey(dayIndex, item.id);
      const turningOn = (current[key] ?? 0) === 0;
      const next = { ...current, [key]: turningOn ? 1 : 0 };
      if (turningOn && MAIN_SERVICE_TYPES.has(item.serviceType)) {
        for (const other of data?.usageItems ?? []) {
          if (other.id !== item.id && MAIN_SERVICE_TYPES.has(other.serviceType)) next[usageSlotKey(dayIndex, other.id)] = 0;
        }
      }
      return { ...prev, [participantId]: next };
    });
  }

  function getDraftTotal(participantId: number) {
    return slots.reduce((sum, slot) => sum + (drafts[participantId]?.[slot.key] ?? 0), 0);
  }

  function getDraftSummary(participantId: number) {
    return slots
      .filter((slot) => (drafts[participantId]?.[slot.key] ?? 0) > 0)
      .map((slot) => `${overnight ? `${slot.day.dayIndex}일차 ` : ""}${slot.item.name} ${drafts[participantId]?.[slot.key]}`)
      .join(" · ") || "이용 없음";
  }

  /** 예상 금액. 정회원 장비 지원은 첫 이용일만이라 1박 둘째 날 장비는 실제 청구에서 샵 가격이 될 수 있다. */
  function getExpectedMemberAmount(participant: ParticipantRow) {
    return slots.reduce((sum, slot) => {
      const unitPrice = participant.companionId === null
        ? slot.item.regularMemberUnitPrice
        : slot.item.companionMemberUnitPrice;
      return sum + unitPrice * (drafts[participant.participantId]?.[slot.key] ?? 0);
    }, 0);
  }

  async function handleSubmit(participantId: number) {
    if (!data) return;
    const participant = participants.find((item) => item.participantId === participantId);
    if (!participant?.canSubmit) {
      setError(participant?.lockedReason ?? "이용 내역을 제출할 수 없습니다.");
      return;
    }

    setSavingParticipantId(participantId);
    setError(null);
    try {
      const items = usageSlotKeys(data.meeting.days, data.usageItems).map((key) => ({
        ...parseUsageSlotKey(key),
        quantity: drafts[participantId]?.[key] ?? 0,
      }));
      const res = await fetch(`/api/meetings/${meetingId}/usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, items }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "이용 내역을 저장하지 못했습니다.");
      const usageData = next as ParticipantMeetingSurfUsageData;
      setData(usageData);
      // 제출한 사람만 서버 기록으로 다시 채운다. 다른 사람의 고치던 내용은 그대로 둔다.
      const saved = usageData.participants.find((item) => item.participantId === participantId);
      if (saved) {
        setDrafts((prev) => ({
          ...prev,
          [participantId]: buildUsageDraft(saved, usageData.meeting.days, usageData.usageItems),
        }));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "이용 내역을 저장하지 못했습니다.");
    } finally {
      setSavingParticipantId(null);
    }
  }

  if (!data) {
    return (
      <section className="brand-card-soft rounded-2xl p-4">
        <h3 className="text-base font-extrabold text-brand-text">실제 이용 확인</h3>
        <p className="brand-text-subtle mt-1 text-xs">{error ?? "이용 항목을 불러오는 중입니다."}</p>
      </section>
    );
  }

  // 이용 기록은 운영진이 하므로, 제출 기간이 아니고 기록도 없으면 회원 화면에서 숨긴다.
  if (!data.meeting.usageOpen && participants.every((participant) => participant.submissionStatus === "missing")) {
    return null;
  }

  return (
    <section className="brand-card-soft space-y-4 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-brand-text">실제 이용 확인</h3>
          <p className="brand-text-subtle mt-1 text-xs">운영진이 실제 이용을 기록합니다. 신청과 다르게 이용했다면 직접 고쳐도 됩니다. 최종 금액은 청구 공개 후 확정됩니다.</p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
            data.meeting.usageOpen ? "brand-chip-dark" : "brand-button-secondary"
          }`}
        >
          {data.meeting.usageOpen ? "제출 가능" : "마감"}
        </span>
      </div>

      <div className="space-y-2">
        {participants.map((participant) => {
          const expanded = expandedId === participant.participantId;
          const saving = savingParticipantId === participant.participantId;
          const draftTotal = getDraftTotal(participant.participantId);

          return (
            <div key={participant.participantId} className="brand-panel-white overflow-hidden rounded-2xl">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : participant.participantId)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-brand-text">{participant.name}</p>
                  <p className="brand-text-subtle mt-1 truncate text-xs">{getCollapsedSummary(participant, overnight)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${getStatusChipClass(
                      participant.submissionStatus
                    )}`}
                  >
                    {getStatusLabel(participant.submissionStatus)}
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                    className={`brand-text-subtle h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                  >
                    <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>

              {expanded ? (
                <div className="border-t border-brand-divider p-3">
                  <div className="mb-3 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 rounded-xl bg-brand-primary-soft px-3 py-3 text-xs">
                    <span className="brand-text-subtle font-semibold">이용 예정</span>
                    <strong className="text-brand-text">{participant.requestedOptionLabel}</strong>
                    <span className="brand-text-subtle font-semibold">실제 이용</span>
                    <strong className="text-brand-text">{getDraftSummary(participant.participantId)}</strong>
                  </div>
                  {participant.canSubmit ? (
                    <>
                      {participant.submissionStatus === "missing" && participant.entries.length === 0 ? (
                        <p className="brand-text-subtle mb-2 px-1 text-xs">신청 내용으로 미리 골라 두었습니다. 실제와 다르면 고친 뒤 제출해 주세요.</p>
                      ) : null}
                      <div className="space-y-2">
                        {slots.map(({ day, item, key }) => {
                          const value = drafts[participant.participantId]?.[key] ?? 0;
                          const selected = value > 0;
                          const label = overnight ? `${day.dayIndex}일차 ${item.name}` : item.name;
                          return (
                            <div key={key}>
                              {overnight && item.id === data.usageItems[0]?.id ? (
                                <p className="brand-text-subtle px-1 pb-1 pt-2 text-xs font-extrabold">{day.dayIndex}일차 · {Number(day.date.slice(5, 7))}.{Number(day.date.slice(8, 10))}</p>
                              ) : null}
                              <button
                                aria-checked={selected}
                                aria-label={`${participant.name} ${label}`}
                                className={`brand-select-card flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${selected ? "brand-select-card-active" : ""}`}
                                onClick={() => toggleSlot(participant.participantId, day.dayIndex, item)}
                                role="checkbox"
                                type="button"
                              >
                                <span className={`brand-choice-indicator flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${selected ? "brand-check-active brand-choice-indicator-active" : ""}`}>
                                  {selected ? <Icon className="text-[16px]" name="check" /> : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-brand-text">{item.name}</span>
                                  {item.description ? (
                                    <span className="brand-text-subtle mt-0.5 block text-xs">{item.description}</span>
                                  ) : null}
                                </span>
                                {value > 1 ? <span className="shrink-0 text-xs font-bold text-brand-text">{value}개</span> : null}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-primary-soft px-3 py-2 text-xs">
                        <span className="font-semibold text-brand-text">예상 회원 부담</span>
                        <strong className="text-sm text-brand-text">{formatWon(getExpectedMemberAmount(participant))}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSubmit(participant.participantId)}
                        disabled={saving}
                        className="brand-button-primary mt-3 w-full rounded-2xl py-3 text-sm font-bold disabled:cursor-not-allowed"
                      >
                        {saving ? "제출 중..." : draftTotal > 0 ? "이용 내역 제출" : "이용 없음으로 제출"}
                      </button>
                    </>
                  ) : (
                    <p className="brand-text-subtle text-xs">{participant.lockedReason}</p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="brand-alert-error rounded-2xl px-3 py-2 text-xs font-bold">{error}</p> : null}
    </section>
  );
}
