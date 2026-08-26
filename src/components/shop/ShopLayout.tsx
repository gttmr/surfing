"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { MobileAppHeader, MobileDock } from "@/components/ui/MobileShell";

interface ShopLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/shop", label: "홈", icon: "dashboard", exact: true },
  { href: "/shop/orders", label: "주문", icon: "receipt_long", exact: false },
  { href: "/shop/usage", label: "이용 확인", icon: "checklist", exact: false },
  { href: "/shop/menus", label: "메뉴 관리", icon: "restaurant_menu", exact: false },
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
    <div className="min-h-screen bg-brand-page text-brand-text">
      <MobileAppHeader
        context="샵 운영"
        trailing={(
          <>
            <Link aria-label="내 정보와 화면 전환" className="brand-touch-target flex items-center justify-center rounded-full" href="/profile">
              <Icon className="text-[22px]" name="account_circle" />
            </Link>
          <button
            aria-label="로그아웃"
            type="button"
            onClick={handleLogout}
            className="brand-touch-target flex items-center justify-center rounded-full"
          >
            <Icon className="text-[21px]" name="logout" />
          </button>
          </>
        )}
      />

      <div className="flex w-full flex-1 flex-col">
        <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
      </div>

      <MobileDock
        items={NAV_ITEMS.map((item) => ({
          active: isActive(item),
          href: item.href,
          icon: <Icon className="text-[22px]" name={item.icon} />,
          label: item.label,
        }))}
        label="샵 메뉴"
      />
    </div>
  );
}
