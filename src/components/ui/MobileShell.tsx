"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { MouseEventHandler, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export type MobileDockItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function MobileDock({ label, items, className = "" }: { label: string; items: readonly MobileDockItem[]; className?: string }) {
  return (
    <nav aria-label={label} className={`brand-bottom-dock brand-mobile-fixed-bar fixed bottom-0 z-40 ${className}`}>
      <div className="flex w-full pb-[calc(var(--brand-safe-bottom)+0.2rem)]">
        {items.map((item) => (
          <Link
            aria-current={item.active ? "page" : undefined}
            aria-disabled={item.disabled || undefined}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold transition-colors ${item.active ? "text-brand-text" : "brand-text-subtle"} ${item.disabled ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
            href={item.href}
            key={item.href}
            onClick={item.onClick}
            tabIndex={item.disabled ? -1 : undefined}
          >
            {item.icon}
            <span className="max-w-full truncate">{item.label}</span>
            <span
              aria-hidden
              className={`h-1 w-4 rounded-full ${item.active ? "bg-brand-primary" : "bg-transparent"}`}
            />
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function RouteStateShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center px-4 py-12">{children}</main>;
}

export function MobileAppHeader({
  context,
  trailing,
  onHomeClick,
}: {
  readonly context?: string;
  readonly trailing?: ReactNode;
  readonly onHomeClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <header className="brand-header-surface sticky top-0 z-30 border-b border-brand-divider pt-[var(--brand-safe-top)]">
      <div className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="모임 달력 홈으로 이동"
            className="brand-touch-target flex shrink-0 items-center"
            href="/"
            onClick={onHomeClick}
          >
            <Image alt="SDS Surfing" className="h-auto w-[76px]" height={716} priority src="/logo.png" width={1148} />
          </Link>
          {context ? (
            <>
              <span aria-hidden className="h-5 w-px bg-brand-divider" />
              <span className="truncate text-xs font-extrabold text-brand-text">{context}</span>
            </>
          ) : null}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
      </div>
    </header>
  );
}

const MEMBER_NAV_ITEMS = [
  { href: "/", label: "모임", icon: "calendar_month", exact: true },
  { href: "/settlement", label: "청구", icon: "receipt_long", exact: false },
  { href: "/notifications", label: "알림", icon: "notifications", exact: false },
  { href: "/profile", label: "내 정보", icon: "person", exact: false },
] as const;

export function MemberDock() {
  const pathname = usePathname();
  return (
    <MobileDock
      items={MEMBER_NAV_ITEMS.map((item) => ({
        active: item.exact ? pathname === item.href : pathname.startsWith(item.href),
        href: item.href,
        icon: <Icon className="text-[22px]" name={item.icon} />,
        label: item.label,
      }))}
      label="회원 메뉴"
    />
  );
}
