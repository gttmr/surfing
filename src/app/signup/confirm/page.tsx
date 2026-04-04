import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ParticipantStatus } from "@/lib/types";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; waitlist?: string; meetingId?: string; name?: string; companions?: string }>;
}) {
  const { status, waitlist, meetingId, name, companions } = await searchParams;
  const companionCount = companions ? parseInt(companions) : 0;

  let meetingDisplay = "";
  if (meetingId) {
    const meeting = await prisma.meeting.findUnique({ where: { id: parseInt(meetingId) } });
    if (meeting) {
      const date = new Date(meeting.date + "T00:00:00");
      const dayName = DAY_KO[date.getDay()];
      const [, month, day] = meeting.date.split("-");
      meetingDisplay = `${parseInt(month)}월 ${parseInt(day)}일 (${dayName}) ${meeting.startTime}`;
    }
  }

  const participantStatus = (status as ParticipantStatus) || "APPROVED";
  const waitlistPos = waitlist ? parseInt(waitlist) : null;

  const statusMessages: Record<string, string> = {
    APPROVED: "모임 참가가 확정되었습니다!",
    WAITLISTED: `정원 초과로 대기자 ${waitlistPos}번째로 등록되었습니다.`,
    CANCELLED: "참가가 취소되었습니다.",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-hero-gradient text-white">
        <div className="max-w-xl mx-auto px-4 py-5">
          <h1 className="font-bold text-lg">신청 완료</h1>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto px-4 py-12 w-full">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-xl font-extrabold text-slate-900 mb-2">신청이 완료되었습니다!</h2>
          <p className="text-sm text-slate-500 mb-6">{statusMessages[participantStatus] ?? "신청이 처리되었습니다."}</p>

          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-6">
            {name && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">이름</span>
                <span className="font-semibold text-slate-800">{decodeURIComponent(name)}</span>
              </div>
            )}
            {meetingDisplay && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">모임</span>
                <span className="font-semibold text-slate-800">{meetingDisplay}</span>
              </div>
            )}
            {companionCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">동반인</span>
                <span className="font-semibold text-orange-600">{companionCount}명 함께 신청</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">상태</span>
              <StatusBadge status={participantStatus} waitlistPosition={waitlistPos} size="sm" />
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-4">홈 화면에서 참가 상태를 확인하거나 취소할 수 있습니다.</p>

          <Link
            href="/"
            className="inline-block w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors"
          >
            &larr; 홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}
