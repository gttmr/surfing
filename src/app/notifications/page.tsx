import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/active-session";
import { prisma } from "@/lib/db";
import { Icon } from "@/components/ui/Icon";
import { MemberDock, MobileAppHeader } from "@/components/ui/MobileShell";

export const dynamic = "force-dynamic";

function notificationLabel(type: string) {
  if (type === "BILLING_PUBLISHED") return "청구 공개";
  if (type === "PAYMENT_VERIFIED") return "입금 확인";
  if (type === "ORDER_CANCELLED") return "주문 변경";
  return "개인 알림";
}

export default async function NotificationsPage() {
  const session = await getActiveSession();
  if (!session) redirect(`/api/auth/kakao?returnTo=${encodeURIComponent("/notifications")}`);

  const [notices, notifications] = await Promise.all([
    prisma.notice.findMany({
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: 20,
    }),
    prisma.userNotification.findMany({
      where: { recipientKakaoId: session.kakaoId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const groupedNotifications = Array.from(notifications.reduce((groups, item) => {
    const key = `${item.type}:${item.meetingId ?? item.id}`;
    const current = groups.get(key);
    if (current) current.count += 1;
    else groups.set(key, { item, count: 1 });
    return groups;
  }, new Map<string, { item: (typeof notifications)[number]; count: number }>()).values());

  return (
    <div className="min-h-screen bg-brand-page text-brand-text">
      <MobileAppHeader context="알림" />
      <main className="space-y-9 px-4 pb-28 pt-6">
        <section aria-labelledby="personal-alerts-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="brand-text-subtle text-xs font-bold">내가 확인할 일</p>
              <h1 className="mt-1 text-xl font-extrabold" id="personal-alerts-title">개인 알림</h1>
            </div>
            <span className="brand-chip-soft rounded-full px-2.5 py-1 text-xs font-bold">{groupedNotifications.length}건</span>
          </div>
          {groupedNotifications.length === 0 ? (
            <div className="border-y border-brand-divider py-8 text-center">
              <Icon className="brand-text-subtle text-[30px]" name="notifications_none" />
              <p className="mt-2 text-sm font-bold">확인할 개인 알림이 없습니다</p>
            </div>
          ) : (
            <div className="border-t border-brand-divider">
              {groupedNotifications.map(({ item, count }) => {
                const href = item.type === "BILLING_PUBLISHED" || item.type === "PAYMENT_VERIFIED"
                  ? "/settlement"
                  : item.meetingId
                    ? `/?meetingId=${item.meetingId}`
                    : "/";
                return (
                  <Link className="flex min-h-20 items-center gap-3 border-b border-brand-divider py-4" href={href} key={`${item.type}:${item.meetingId ?? item.id}`}>
                    <span className="brand-chip-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                      <Icon className="text-[20px]" name={item.type === "PAYMENT_VERIFIED" ? "task_alt" : item.type === "BILLING_PUBLISHED" ? "receipt_long" : "notifications"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="brand-text-subtle block text-[11px] font-bold">{notificationLabel(item.type)}{count > 1 ? ` · ${count}건 묶음` : ""}</span>
                      <span className="mt-1 block text-sm font-extrabold">{item.title}</span>
                      <span className="brand-text-muted mt-1 block text-xs leading-5">{item.body}</span>
                    </span>
                    <Icon aria-hidden className="brand-text-subtle text-[19px]" name="chevron_right" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="notices-title">
          <div className="mb-3">
            <p className="brand-text-subtle text-xs font-bold">운영진이 작성한 글</p>
            <h2 className="mt-1 text-xl font-extrabold" id="notices-title">공지사항</h2>
          </div>
          {notices.length === 0 ? (
            <p className="border-y border-brand-divider py-8 text-center text-sm brand-text-muted">등록된 공지가 없습니다.</p>
          ) : (
            <div className="border-t border-brand-divider">
              {notices.map((notice) => (
                <details className="border-b border-brand-divider" key={notice.id}>
                  <summary className="brand-touch-target flex cursor-pointer list-none items-center justify-between gap-3 py-4">
                    <span>
                      <span className="text-sm font-extrabold">{notice.title}</span>
                      <span className="brand-text-subtle mt-1 block text-xs">{notice.isPinned ? "중요 공지 · " : ""}{notice.updatedAt.toLocaleDateString("ko-KR")}</span>
                    </span>
                    <Icon className="brand-text-subtle text-[19px]" name="expand_more" />
                  </summary>
                  <p className="brand-text-muted whitespace-pre-line pb-5 text-sm leading-6">{notice.body}</p>
                </details>
              ))}
            </div>
          )}
        </section>
      </main>
      <MemberDock />
    </div>
  );
}
