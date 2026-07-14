"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MobileDock } from "@/components/ui/MobileShell";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/admin", label: "메시지관리", icon: "📢", exact: true },
  { href: "/admin/meetings", label: "모임관리", icon: "👥", exact: false },
  { href: "/admin/members", label: "회원관리", icon: "🧑‍💼", exact: false },
  { href: "/admin/pricing", label: "비용책정", icon: "💳", exact: false },
  { href: "/admin/menus", label: "메뉴관리", icon: "☕", exact: false },
  { href: "/admin/settings", label: "설정", icon: "⚙️", exact: false },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function isActive(item: (typeof NAV_ITEMS)[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="brand-admin-shell">
      <header className="brand-header-surface sticky top-0 z-20 border-b border-[var(--brand-divider)]">
        <div className="mx-auto flex w-full items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="brand-link text-sm font-semibold transition-colors">&larr; 사이트</Link>
            <span className="brand-text-subtle">|</span>
            <span className="font-headline text-sm font-extrabold tracking-[-0.02em]">관리자</span>
          </div>
          <button
            onClick={handleLogout}
            className="brand-button-secondary rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full flex-1 flex-col md:flex-row">
        <aside className="hidden w-56 shrink-0 p-4 md:block md:p-6">
          <nav className="brand-card-soft sticky top-24 space-y-1 rounded-3xl p-3">
            {NAV_ITEMS.map((item) => (
              <Link
                aria-current={isActive(item) ? "page" : undefined}
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors
                  ${isActive(item)
                    ? "brand-chip-dark"
                    : "brand-list-item brand-list-item-hover"
                  }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 px-4 pb-32 pt-5 md:px-6 md:pb-8 md:pt-6">
          {children}
        </main>
      </div>

      <MobileDock
        className="md:hidden"
        items={NAV_ITEMS.map((item) => ({
          active: isActive(item),
          href: item.href,
          icon: <span aria-hidden className="text-xl">{item.icon}</span>,
          label: item.label,
        }))}
        label="관리자 메뉴"
      />
    </div>
  );
}
