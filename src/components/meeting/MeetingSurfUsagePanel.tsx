"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParticipantMeetingSurfUsageData } from "@/lib/surf-usage-data";

type DraftMap = Record<number, Record<number, number>>;

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

function getStatusLabel(status: ParticipantMeetingSurfUsageData["participants"][number]["submissionStatus"]) {
  if (status === "confirmed") return "샵 확정";
  if (status === "submitted") return "제출됨";
  return "미제출";
}

export function MeetingSurfUsagePanel({ meetingId }: { meetingId: number }) {
  const [data, setData] = useState<ParticipantMeetingSurfUsageData | null>(null);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
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
        setSelectedParticipantId(
          usageData.participants.find((participant) => participant.canSubmit)?.participantId ??
            usageData.participants[0]?.participantId ??
            null
        );
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
  const selectedParticipant =
    participants.find((participant) => participant.participantId === selectedParticipantId) ??
    participants[0] ??
    null;

  const selectedTotalQuantity = useMemo(() => {
    if (!selectedParticipant || !data) return 0;
    return data.usageItems.reduce(
      (sum, item) => sum + (drafts[selectedParticipant.participantId]?.[item.id] ?? 0),
      0
    );
  }, [data, drafts, selectedParticipant]);

  function updateQuantity(participantId: number, usageItemId: number, nextValue: number) {
    setDrafts((prev) => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] ?? {}),
        [usageItemId]: Math.max(0, Math.min(20, nextValue)),
      },
    }));
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
      <section className="brand-card-soft rounded-3xl p-4">
        <p className="text-sm font-bold text-[var(--brand-text)]">실제 이용 내역</p>
        <p className="brand-text-subtle mt-1 text-xs">{error ?? "이용 항목을 불러오는 중입니다."}</p>
      </section>
    );
  }

  return (
    <section className="brand-card-soft space-y-4 rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[var(--brand-text)]">실제 이용 내역</h3>
          <p className="brand-text-subtle mt-1 text-xs">당일 실제 이용한 항목을 제출해 주세요. 금액은 정산 공개 때 확인합니다.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${data.meeting.usageOpen ? "brand-chip-dark" : "brand-chip-soft"}`}>
          {data.meeting.usageOpen ? "제출 가능" : "마감"}
        </span>
      </div>

      <div className="grid gap-2">
        {participants.map((participant) => (
          <button
            key={participant.participantId}
            type="button"
            onClick={() => setSelectedParticipantId(participant.participantId)}
            className={`brand-panel-white rounded-2xl px-3 py-3 text-left transition-colors ${
              selectedParticipant?.participantId === participant.participantId ? "ring-2 ring-[var(--brand-primary)]" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--brand-text)]">{participant.name}</p>
                <p className="brand-text-subtle mt-0.5 text-[11px]">{participant.roleLabel}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                participant.submissionStatus === "confirmed"
                  ? "brand-chip-success"
                  : participant.submissionStatus === "submitted"
                    ? "brand-chip-soft"
                    : "brand-chip-danger"
              }`}>
                {getStatusLabel(participant.submissionStatus)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedParticipant ? (
        selectedParticipant.canSubmit ? (
          <div className="brand-panel-white rounded-2xl p-3">
            <p className="mb-3 text-xs font-bold text-[var(--brand-text)]">
              {selectedParticipant.name} 실제 이용 항목
            </p>
            <div className="space-y-2">
              {data.usageItems.map((item) => {
                const value = drafts[selectedParticipant.participantId]?.[item.id] ?? 0;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--brand-divider)] px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--brand-text)]">{item.name}</p>
                      {item.description ? <p className="brand-text-subtle mt-0.5 text-[11px]">{item.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQuantity(selectedParticipant.participantId, item.id, value - 1)}
                        className="brand-button-secondary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-sm font-extrabold text-[var(--brand-text)]">{value}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(selectedParticipant.participantId, item.id, value + 1)}
                        className="brand-button-secondary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
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
              onClick={() => void handleSubmit(selectedParticipant.participantId)}
              disabled={savingParticipantId === selectedParticipant.participantId}
              className="brand-button-primary mt-3 w-full rounded-2xl py-3 text-sm font-bold"
            >
              {savingParticipantId === selectedParticipant.participantId
                ? "제출 중..."
                : selectedTotalQuantity > 0
                  ? `${selectedParticipant.name} 이용 내역 제출`
                  : `${selectedParticipant.name} 이용 없음으로 제출`}
            </button>
          </div>
        ) : (
          <div className="brand-panel-white rounded-2xl p-4">
            <p className="text-sm font-bold text-[var(--brand-text)]">{selectedParticipant.name}</p>
            <p className="brand-text-subtle mt-1 text-xs">{selectedParticipant.lockedReason}</p>
          </div>
        )
      ) : null}

      {error ? <p className="brand-alert-error rounded-2xl px-3 py-2 text-xs font-bold">{error}</p> : null}
    </section>
  );
}
