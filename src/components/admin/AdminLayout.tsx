"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { MobileDock } from "@/components/ui/MobileShell";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/admin", label: "공지", icon: "campaign", exact: true },
  { href: "/admin/meetings", label: "모임", icon: "groups", exact: false },
  { href: "/admin/members", label: "회원", icon: "person_search", exact: false },
  { href: "/admin/pricing", label: "비용", icon: "payments", exact: false },
  { href: "/admin/menus", label: "메뉴", icon: "restaurant_menu", exact: false },
  { href: "/admin/settings", label: "설정", icon: "settings", exact: false },
] as const;

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="brand-admin-shell">
      <header className="brand-header-surface sticky top-0 z-20 border-b border-[var(--brand-divider)] pt-[var(--brand-safe-top)]">
        <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-headline text-sm font-extrabold tracking-[-0.02em]">관리자</p>
            <nav aria-label="서비스 화면" className="mt-1 flex items-center gap-3 text-xs font-semibold">
              <Link href="/" prefetch={false} className="brand-link inline-flex items-center gap-1">
                <Icon className="text-[16px]" name="surfing" /> 회원 화면
              </Link>
              <Link href="/shop" prefetch={false} className="brand-link inline-flex items-center gap-1">
                <Icon className="text-[16px]" name="storefront" /> 샵 화면
              </Link>
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="brand-button-secondary shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-colors"
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
          href: item.href,
          icon: <Icon className="text-[22px]" name={item.icon} />,
          label: item.label,
        }))}
        label="관리자 메뉴"
      />
    </div>
  );
}
