"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminDirtyNavigationGuard } from "@/components/admin/useAdminDirtyNavigationGuard";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { MobileDock } from "@/components/ui/MobileShell";

interface AdminLayoutProps {
  readonly children: React.ReactNode;
  readonly dirtyNavigation?: {
    readonly isDirty: boolean;
    readonly isSaveInFlight: boolean;
    readonly onDiscard: () => void;
  };
}

const NAV_ITEMS = [
  { href: "/admin", label: "공지", icon: "campaign", exact: true },
  { href: "/admin/meetings", label: "모임", icon: "groups", exact: false },
  { href: "/admin/members", label: "회원", icon: "person_search", exact: false },
  { href: "/admin/pricing", label: "비용", icon: "payments", exact: false },
  { href: "/admin/menus", label: "메뉴", icon: "restaurant_menu", exact: false },
  { href: "/admin/settings", label: "설정", icon: "settings", exact: false },
] as const;

export function AdminLayout({ children, dirtyNavigation }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isSaveInFlight = dirtyNavigation?.isSaveInFlight ?? false;

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const leaveGuard = useAdminDirtyNavigationGuard({
    currentPath: pathname,
    discardDraft: dirtyNavigation?.onDiscard,
    isDirty: dirtyNavigation?.isDirty ?? false,
    isSaveInFlight,
    logout: handleLogout,
    push: router.push,
  });

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="brand-admin-shell">
      <Dialog
        description="저장하지 않은 관리자 설정 초안은 복구할 수 없습니다."
        onClose={leaveGuard.stay}
        open={leaveGuard.dialogOpen}
        title="변경 내용을 버릴까요?"
      >
        <div className="flex gap-3">
          <button className="brand-button-secondary min-h-11 flex-1 rounded-2xl px-4 text-sm font-bold" onClick={leaveGuard.stay} type="button">
            계속 편집
          </button>
          <button className="brand-button-danger-solid min-h-11 flex-1 rounded-2xl px-4 text-sm font-bold" disabled={isSaveInFlight} onClick={leaveGuard.discardAndContinue} type="button">
            버리고 이동
          </button>
        </div>
      </Dialog>
      <header className="brand-header-surface sticky top-0 z-20 border-b border-[var(--brand-divider)] pt-[var(--brand-safe-top)]">
        <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-headline text-sm font-extrabold tracking-[-0.02em]">관리자</p>
            <nav aria-label="서비스 화면" className="mt-1 flex items-center gap-3 text-xs font-semibold">
              <Link
                aria-disabled={isSaveInFlight || undefined}
                className={`brand-link inline-flex items-center gap-1 ${isSaveInFlight ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
                href="/"
                onClick={leaveGuard.onNavigate}
                prefetch={false}
                tabIndex={isSaveInFlight ? -1 : undefined}
              >
                <Icon className="text-[16px]" name="surfing" /> 회원 화면
              </Link>
              <Link
                aria-disabled={isSaveInFlight || undefined}
                className={`brand-link inline-flex items-center gap-1 ${isSaveInFlight ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
                href="/shop"
                onClick={leaveGuard.onNavigate}
                prefetch={false}
                tabIndex={isSaveInFlight ? -1 : undefined}
              >
                <Icon className="text-[16px]" name="storefront" /> 샵 화면
              </Link>
            </nav>
          </div>
          <button
            disabled={isSaveInFlight}
            onClick={leaveGuard.requestLogout}
            className="brand-button-secondary shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full flex-1 flex-col">
        <main className="flex-1 px-4 pb-32 pt-5">
          {children}
        </main>
      </div>

      <MobileDock
        items={NAV_ITEMS.map((item) => ({
          active: isActive(item),
          disabled: isSaveInFlight,
          href: item.href,
          icon: <Icon className="text-[22px]" name={item.icon} />,
          label: item.label,
          onClick: leaveGuard.onNavigate,
        }))}
        label="관리자 메뉴"
      />
    </div>
  );
}
