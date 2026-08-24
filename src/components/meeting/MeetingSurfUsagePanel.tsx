"use client";

import { useEffect, useState } from "react";
import type { ParticipantMeetingSurfUsageData } from "@/lib/surf-usage-data";

type DraftMap = Record<number, Record<number, number>>;
type ParticipantRow = ParticipantMeetingSurfUsageData["participants"][number];

function buildDrafts(data: ParticipantMeetingSurfUsageData): DraftMap {
  return Object.fromEntries(
    data.participants.map((participant) => [
      participant.participantId,
      Object.fromEntries(
        data.usageItems.map((item) => [
          item.id,
          participant.entries
            .filter((entry) => entry.usageItemId === item.id)
            .reduce((sum, entry) => sum + entry.quantity, 0),
        ])
      ),
    ])
  );
}

function getStatusLabel(status: ParticipantRow["submissionStatus"]) {
  if (status === "confirmed") return "샵 확정";
  if (status === "submitted") return "제출됨";
  return "미제출";
}

function getStatusChipClass(status: ParticipantRow["submissionStatus"]) {
  if (status === "confirmed") return "brand-chip-success";
  if (status === "submitted") return "brand-chip-soft";
  return "brand-chip-danger";
}

function getCollapsedSummary(participant: ParticipantRow): string {
  const totals = new Map<string, number>();
  for (const entry of participant.entries) {
    if (entry.quantity <= 0) continue;
    totals.set(entry.usageItemName, (totals.get(entry.usageItemName) ?? 0) + entry.quantity);
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

  function updateQuantity(participantId: number, usageItemId: number, nextValue: number) {
    setDrafts((prev) => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] ?? {}),
        [usageItemId]: Math.max(0, Math.min(20, nextValue)),
      },
    }));
  }

  function getDraftTotal(participantId: number) {
    if (!data) return 0;
    return data.usageItems.reduce((sum, item) => sum + (drafts[participantId]?.[item.id] ?? 0), 0);
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
      const items = data.usageItems.map((item) => ({
        usageItemId: item.id,
        quantity: drafts[participantId]?.[item.id] ?? 0,
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
      setDrafts(buildDrafts(usageData));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "이용 내역을 저장하지 못했습니다.");
    } finally {
      setSavingParticipantId(null);
    }
  }

  if (!data) {
    return (
      <section className="brand-card-soft rounded-2xl p-4">
        <h3 className="text-base font-extrabold text-brand-text">실제 이용 내역</h3>
        <p className="brand-text-subtle mt-1 text-xs">{error ?? "이용 항목을 불러오는 중입니다."}</p>
      </section>
    );
  }

  return (
    <section className="brand-card-soft space-y-4 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-brand-text">실제 이용 내역</h3>
          <p className="brand-text-subtle mt-1 text-xs">당일 실제 이용한 항목을 제출해 주세요. 금액은 정산 공개 때 확인합니다.</p>
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
                  <p className="brand-text-subtle mt-1 truncate text-xs">{getCollapsedSummary(participant)}</p>
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
                  {participant.canSubmit ? (
                    <>
                      <div className="space-y-2">
                        {data.usageItems.map((item) => {
                          const value = drafts[participant.participantId]?.[item.id] ?? 0;
                          return (
                            <div
                              key={item.id}
                              className="brand-list-item flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-brand-text">{item.name}</p>
                                {item.description ? (
                                  <p className="brand-text-subtle mt-0.5 text-xs">{item.description}</p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(participant.participantId, item.id, value - 1)}
                                  className="brand-button-secondary h-9 w-9 rounded-full text-base font-bold"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center text-sm font-bold text-brand-text">{value}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(participant.participantId, item.id, value + 1)}
                                  className="brand-button-primary h-9 w-9 rounded-full text-base font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
