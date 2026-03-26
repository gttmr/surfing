import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminLayout } from "@/components/admin/AdminLayout";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const today = new Date().toISOString().split("T")[0];

  const [upcomingMeetings, recentParticipants] = await Promise.all([
    prisma.meeting.findMany({
      where: { date: { gte: today } },
      orderBy: { date: "asc" },
      take: 3,
      include: { participants: { select: { status: true } } },
    }),
    prisma.participant.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: { meeting: { select: { date: true } } },
    }),
  ]);

  const totalApproved = upcomingMeetings.reduce(
    (sum, m) => sum + m.participants.filter((p) => p.status === "APPROVED").length,
    0
  );
  const totalWaitlisted = upcomingMeetings.reduce(
    (sum, m) => sum + m.participants.filter((p) => p.status === "WAITLISTED").length,
    0
  );
  const totalCancelled = upcomingMeetings.reduce(
    (sum, m) => sum + m.participants.filter((p) => p.status === "CANCELLED").length,
    0
  );

  const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

  function timeAgo(date: Date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  }

  return (
    <AdminLayout>
      <h1 className="text-xl font-extrabold text-slate-900 mb-6">대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "참가 확정", value: totalApproved, color: "text-green-600" },
          { label: "대기자", value: totalWaitlisted, color: "text-blue-600" },
          { label: "취소", value: totalCancelled, color: "text-red-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* 예정된 모임 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700">예정된 모임</h2>
          <Link href="/admin/meetings" className="text-xs text-blue-600 hover:underline">전체 보기 &rarr;</Link>
        </div>
        <div className="space-y-3">
          {upcomingMeetings.map((m) => {
            const approved = m.participants.filter((p) => p.status === "APPROVED").length;
            const d = new Date(m.date + "T00:00:00");
            const [, month, day] = m.date.split("-");
            const pct = Math.min((approved / m.maxCapacity) * 100, 100);

            return (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {parseInt(month)}월 {parseInt(day)}일 ({DAY_KO[d.getDay()]}) {m.startTime}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.location}</p>
                  </div>
                  <Link
                    href={`/admin/meetings/${m.id}`}
                    className="text-xs text-blue-600 hover:underline shrink-0 ml-2"
                  >
                    관리 &rarr;
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 85 ? "bg-amber-400" : "bg-green-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-600 shrink-0">{approved}/{m.maxCapacity}명</span>
                </div>
              </div>
            );
          })}
          {upcomingMeetings.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">예정된 모임이 없습니다</p>
          )}
        </div>
      </section>

      {/* 최근 활동 */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 mb-3">최근 신청</h2>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {recentParticipants.map((p) => {
            const statusColors: Record<string, string> = {
              APPROVED: "text-green-600",
              WAITLISTED: "text-blue-600",
              CANCELLED: "text-slate-400",
            };
            const statusLabels: Record<string, string> = {
              APPROVED: "참가 확정",
              WAITLISTED: "대기자",
              CANCELLED: "취소됨",
            };
            return (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-800">{p.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{timeAgo(p.submittedAt)}</span>
                </div>
                <span className={`text-xs font-semibold ${statusColors[p.status]}`}>
                  {statusLabels[p.status]}
                </span>
              </div>
            );
          })}
          {recentParticipants.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">신청 내역이 없습니다</p>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
