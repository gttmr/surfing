"use client";

import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";

export type MobileDockItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly active: boolean;
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function MobileDock({ label, items, className = "" }: { label: string; items: readonly MobileDockItem[]; className?: string }) {
  return (
    <nav aria-label={label} className={`brand-bottom-dock brand-mobile-fixed-bar fixed bottom-0 z-40 ${className}`}>
      <div className="flex w-full pb-[calc(var(--brand-safe-bottom)+0.2rem)]">
        {items.map((item) => (
          <Link
            aria-current={item.active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold transition-colors ${item.active ? "text-[var(--brand-text)]" : "brand-text-subtle"}`}
            href={item.href}
            key={item.href}
            onClick={item.onClick}
          >
            {item.icon}
            <span className="max-w-full truncate">{item.label}</span>
            <span
              aria-hidden
              className={`h-1 w-4 rounded-full ${item.active ? "bg-[var(--brand-primary)]" : "bg-transparent"}`}
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
