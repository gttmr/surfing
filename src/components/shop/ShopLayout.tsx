"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

interface ShopLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/shop", label: "주문보드", icon: "receipt_long", exact: true },
  { href: "/shop/menus", label: "메뉴관리", icon: "restaurant_menu", exact: false },
];

export function ShopLayout({ children }: ShopLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function isActive(item: (typeof NAV_ITEMS)[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="min-h-screen bg-[var(--brand-page)] text-[var(--brand-text)]">
      <header className="brand-header-surface sticky top-0 z-20">
        <div className="mx-auto flex w-full max-w-[430px] items-center justify-between px-4 py-3 md:max-w-5xl md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="brand-link text-sm font-semibold transition-colors">&larr; 사이트</Link>
            <span className="brand-text-subtle">|</span>
            <span className="font-headline text-sm font-extrabold tracking-[-0.02em]">샵 포털</span>
          </div>
          <button
            onClick={handleLogout}
            className="brand-button-secondary rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col md:max-w-5xl md:flex-row">
        <aside className="hidden w-52 shrink-0 p-4 md:block md:p-6">
          <nav className="brand-card-soft sticky top-24 space-y-1 rounded-3xl p-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors ${
                  isActive(item) ? "brand-chip-dark" : "brand-list-item brand-list-item-hover"
                }`}
              >
                <Icon name={item.icon} className="text-[20px]" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-8 md:pt-6">{children}</main>
      </div>

      <nav className="brand-bottom-dock fixed bottom-0 left-0 right-0 z-20 md:hidden">
        <div className="mx-auto flex max-w-[430px] pb-[calc(env(safe-area-inset-bottom)+0.2rem)]">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center py-2 text-xs font-semibold transition-colors ${
                isActive(item) ? "text-[var(--brand-text)]" : "brand-text-subtle"
              }`}
            >
              <Icon name={item.icon} className="text-[22px]" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
