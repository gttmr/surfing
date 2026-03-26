import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { CapacityBar } from "@/components/ui/CapacityBar";
import { SignupForm } from "@/components/meeting/SignupForm";
import type { MeetingWithCounts } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

type DetailedMeeting = MeetingWithCounts & {
  participantsList: {
    id: number;
    name: string;
    note: string | null;
    status: string;
  }[];
};

async function getMeeting(id: number): Promise<DetailedMeeting | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: {
        select: { id: true, name: true, note: true, status: true },
        orderBy: { submittedAt: "asc" },
        where: { status: { not: "CANCELLED" } },
      },
    },
  });

  if (!meeting) return null;

  return {
    id: meeting.id,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    maxCapacity: meeting.maxCapacity,
    description: meeting.description,
    isOpen: meeting.isOpen,
    approvedCount: meeting.participants.filter((p) => p.status === "APPROVED").length,
    waitlistedCount: meeting.participants.filter((p) => p.status === "WAITLISTED").length,
    participantsList: meeting.participants,
  };
}

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = await getMeeting(parseInt(id));
  if (!meeting) notFound();

  const date = new Date(meeting.date + "T00:00:00");
  const dayName = DAY_KO[date.getDay()];
  const [, month, day] = meeting.date.split("-");
  const displayDate = `${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${dayName})`;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-hero-gradient text-white">
        <div className="max-w-xl mx-auto px-4 py-5 flex items-center gap-3">
          <Link href="/" className="text-blue-200 hover:text-white transition-colors text-xl leading-none">&larr;</Link>
          <h1 className="font-bold text-lg">모임 신청</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* 모임 정보 카드 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-xl font-extrabold text-slate-900 mb-4">
            {dayName}요일 모임
          </h2>
          <div className="space-y-2 text-sm text-slate-600 mb-5">
            <div className="flex items-center gap-2.5">
              <span className="text-base">📅</span>
              <span className="font-medium text-slate-800">{displayDate}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-base">📍</span>
              <span>{meeting.location}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-base">🕐</span>
              <span>{meeting.startTime} – {meeting.endTime}</span>
            </div>
          </div>

          {meeting.description && (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-5">{meeting.description}</p>
          )}

          <CapacityBar current={meeting.approvedCount} max={meeting.maxCapacity} waitlisted={meeting.waitlistedCount} />
        </div>

        {/* 신청 폼 카드 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-800 mb-4">참가 신청</h3>
          <SignupForm meeting={meeting} />
        </div>

        {/* 참석 명단 */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold text-slate-800">참석 현황</h2>
            <span className="bg-blue-100 text-blue-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
              {meeting.participantsList.length}명
            </span>
          </div>

          {meeting.participantsList.length > 0 ? (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 divide-y">
              {meeting.participantsList.map((p, i) => (
                <div key={p.id} className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 text-sm font-medium">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                      {p.name}
                      {p.status === "WAITLISTED" && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">대기</span>
                      )}
                      {p.status === "APPROVED" && (
                        <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold">참석 확정</span>
                      )}
                    </p>
                    {p.note && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{p.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
              <div className="text-4xl mb-3">🏄</div>
              <p className="text-slate-500 font-medium">아직 참가 신청자가 없습니다</p>
              <p className="text-sm text-slate-400 mt-1">가장 먼저 참석을 확정해 보세요!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
