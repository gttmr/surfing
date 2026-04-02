import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import ScheduleView from "./ScheduleView";

export default async function SchedulePageContent() {
  const user = await getSession();

  const userRole = user
    ? (await prisma.user.findUnique({ where: { kakaoId: user.kakaoId }, select: { role: true } }))?.role ?? null
    : null;
  const isAdmin = userRole === "ADMIN";

  const [meetings, pinnedNotice] = await Promise.all([
    prisma.meeting.findMany({
      orderBy: { date: "asc" },
      include: { participants: { select: { status: true } } },
    }),
    prisma.notice.findFirst({
      where: { isPinned: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const meetingsForClient = meetings.map((meeting) => ({
    id: meeting.id,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    description: meeting.description,
    isOpen: meeting.isOpen,
    meetingType: meeting.meetingType,
    createdByKakaoId: meeting.createdByKakaoId,
    approvedCount: meeting.participants.filter((participant) => participant.status === "APPROVED").length,
  }));

  return (
    <div className="min-h-screen">
      <header className="bg-hero-gradient text-white">
        <div className="max-w-xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="로고" className="w-10 h-10 rounded-lg object-contain bg-black/30 shrink-0" />
            <div>
              <h1 className="font-bold text-lg">전체 일정</h1>
              <p className="text-blue-200 text-xs mt-0.5">동호회 모임 일정을 한눈에 확인하세요</p>
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-2 rounded-lg bg-purple-500/80 hover:bg-purple-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  관리자
                </Link>
              )}
              <Link
                href="/profile"
                className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/20 text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                내 프로필
              </Link>
            </div>
          ) : (
            <Link
              href={`/api/auth/kakao?returnTo=/`}
              className="px-3 py-2 rounded-lg bg-[#FEE500] hover:bg-[#f0d800] text-[#3C1E1E] text-sm font-bold transition-colors whitespace-nowrap"
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      {pinnedNotice && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-start gap-2">
            <span className="text-amber-500 text-sm font-bold shrink-0">📢</span>
            <div>
              <span className="text-sm font-semibold text-amber-800">{pinnedNotice.title}</span>
              <p className="text-xs text-amber-700 mt-0.5 line-clamp-2">{pinnedNotice.body}</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <ScheduleView meetings={meetingsForClient} isLoggedIn={!!user} />
      </main>

      <footer className="max-w-xl mx-auto px-4 py-8 text-center text-sm text-slate-400 border-t border-slate-200 mt-8">
        <p>문의: 동호회 단톡방</p>
        <Link href="/admin" className="text-slate-300 hover:text-slate-500 text-xs mt-2 inline-block transition-colors">
          관리자
        </Link>
      </footer>
    </div>
  );
}
