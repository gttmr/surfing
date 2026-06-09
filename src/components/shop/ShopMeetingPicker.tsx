"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ShopMeetingOption } from "@/lib/food-ordering-data";

type MeetingInfo = {
  date: string;
  startTime: string;
  endTime: string;
  location: string;
};

export function ShopMeetingPicker({
  meetings,
  selectedMeetingId,
  meetingInfo,
}: {
  meetings: ShopMeetingOption[];
  selectedMeetingId: number | null;
  meetingInfo: MeetingInfo | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleMeetingChange(nextMeetingId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!nextMeetingId) {
      next.delete("meetingId");
    } else {
      next.set("meetingId", nextMeetingId);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="mb-3 space-y-2.5">
      {meetings.length > 0 ? (
        <label className="brand-panel-white block rounded-[1.7rem] px-4 py-3">
          <span className="brand-text-subtle mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em]">
            모임 선택
          </span>
          <select
            value={selectedMeetingId ?? ""}
            onChange={(event) => handleMeetingChange(event.target.value)}
            className="brand-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
          >
            {meetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {meetingInfo ? (
        <div className="px-1">
          <p className="brand-text-subtle text-[11px] font-medium">
            {meetingInfo.date} {meetingInfo.startTime}–{meetingInfo.endTime} · {meetingInfo.location}
          </p>
        </div>
      ) : null}
    </div>
  );
}
