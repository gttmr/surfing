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
    approvedCount: meeting.participants.filter((p) => p.status === "APPROVED").length,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Stitch TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(26,28,28,0.06)] flex justify-between items-center px-6 py-2">
        <div className="flex items-center gap-3 h-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="로고" className="h-full w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-xl bg-surface-container-low text-on-surface-variant text-sm font-semibold transition-colors hover:bg-surface-container-high whitespace-nowrap"
                >
                  관리자
                </Link>
              )}
              <Link
                href="/profile"
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container cursor-pointer flex items-center justify-center bg-primary-container text-on-primary-container font-bold text-sm"
              >
                <span className="material-symbols-outlined text-xl">person</span>
              </Link>
            </>
          ) : (
            <Link
              href="/api/auth/kakao?returnTo=/"
              className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-sm font-bold transition-colors whitespace-nowrap"
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      {/* 고정 공지 배너 */}
      {pinnedNotice && (
        <div className="fixed top-16 w-full z-40 bg-amber-50 border-b border-amber-200">
          <div className="max-w-md mx-auto px-6 py-2 flex items-start gap-2">
            <span className="text-amber-500 text-sm font-bold shrink-0">📢</span>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-amber-800">{pinnedNotice.title}</span>
              <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">{pinnedNotice.body}</p>
            </div>
          </div>
        </div>
      )}

      <main className={`${pinnedNotice ? "pt-28" : "pt-20"} pb-12 px-6 max-w-md mx-auto`}>
        <ScheduleView meetings={meetingsForClient} isLoggedIn={!!user} isAdmin={isAdmin} />
      </main>

      <footer className="pb-8 text-center px-6 text-xs text-on-surface-variant/40">
        <p>문의: 동호회 단톡방</p>
        {isAdmin && (
          <Link href="/admin" className="mt-1 inline-block hover:text-on-surface-variant transition-colors">
            관리자 대시보드
          </Link>
        )}
      </footer>
    </div>
  );
}
