import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEV_NEW_USER, isDevAuthEnabled, safeReturnTo } from "@/lib/dev-auth";
import { MobileAppHeader } from "@/components/ui/MobileShell";

export const dynamic = "force-dynamic";

const ROLE_ORDER = ["ADMIN", "SHOP_OWNER", "MEMBER", "BANNED"] as const;
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "관리자",
  SHOP_OWNER: "샵 운영자",
  MEMBER: "회원",
  BANNED: "차단",
};

export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (!isDevAuthEnabled()) notFound();

  const returnTo = safeReturnTo((await searchParams).returnTo);
  const users = await prisma.user.findMany({
    select: { kakaoId: true, name: true, role: true, memberType: true },
    orderBy: { name: "asc" },
  });
  const groups = ROLE_ORDER.map((role) => ({
    role,
    users: users.filter((user) => user.role === role),
  })).filter((group) => group.users.length > 0);

  return (
    <div className="min-h-screen bg-brand-page text-brand-text">
      <MobileAppHeader context="개발용 로그인" />
      <main className="mx-auto w-full max-w-[430px] px-4 py-6">
        <div className="brand-alert-info rounded-2xl px-4 py-3 text-sm">
          로컬 개발 전용 화면입니다. 카카오 로그인 대신 아래 회원으로 바로 로그인합니다.
        </div>

        <form action="/api/auth/dev-login" method="post" className="brand-card mt-5 rounded-2xl p-4">
          <input type="hidden" name="kakaoId" value={DEV_NEW_USER} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <h2 className="text-sm font-extrabold">새 회원으로 가입</h2>
          <p className="brand-text-muted mt-1 text-xs">카카오 첫 로그인처럼 회원을 만들고 프로필 설정으로 이동합니다.</p>
          <div className="mt-3 flex gap-2">
            <input name="nickname" placeholder="테스트 회원" className="brand-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm" />
            <button type="submit" className="brand-button-primary shrink-0 rounded-xl px-4 py-2 text-sm font-bold">
              가입
            </button>
          </div>
        </form>

        {groups.map((group) => (
          <section key={group.role} className="mt-6">
            <h2 className="brand-text-subtle mb-2 text-xs font-extrabold">
              {ROLE_LABEL[group.role] ?? group.role} · {group.users.length}
            </h2>
            <ul className="brand-card divide-y divide-brand-divider overflow-hidden rounded-2xl">
              {group.users.map((user) => (
                <li key={user.kakaoId}>
                  <form action="/api/auth/dev-login" method="post">
                    <input type="hidden" name="kakaoId" value={user.kakaoId} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit" className="brand-list-item-hover flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <span className="truncate text-sm font-bold">{user.name || "(이름 없음)"}</span>
                      <span className="brand-text-subtle shrink-0 text-xs">
                        {user.memberType === "COMPANION" ? "동반인 · " : ""}
                        {user.kakaoId}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
