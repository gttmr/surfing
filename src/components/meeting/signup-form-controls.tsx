"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.477 2 10.857c0 2.713 1.584 5.1 3.988 6.577L5 21l4.29-2.287C10.145 18.9 11.058 19 12 19c5.523 0 10-3.477 10-7.143C22 6.477 17.523 3 12 3z" />
    </svg>
  );
}

export function OptionPricingHelp({ guide }: { guide: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="참가 옵션 가격 안내"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
          open
            ? "brand-chip-dark brand-help-trigger-active"
            : "brand-choice"
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[14px] leading-none">info</span>
      </button>
      {open ? (
        <div className="brand-card-soft absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl p-3 text-left">
          <p className="mb-2 text-xs font-bold text-brand-text">가격 안내</p>
          <p className="brand-text-muted whitespace-pre-line text-xs leading-5">{guide}</p>
        </div>
      ) : null}
    </div>
  );
}

function segmentedButtonClass(active: boolean, disabled?: boolean) {
  return [
    "flex-1 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
    active
      ? "bg-brand-primary text-brand-primary-foreground"
      : "bg-brand-surface-elevated text-brand-text border border-brand-divider-strong",
    disabled ? "cursor-not-allowed opacity-50" : active ? "" : "hover:border-brand-primary-border-strong",
  ].join(" ");
}

export function ShuttleBusChoice({
  boarded,
  onChange,
  disabled,
  trailing,
}: {
  boarded: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-text">셔틀버스</p>
        {trailing}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            if (!boarded) onChange(true);
          }}
          disabled={disabled}
          className={segmentedButtonClass(boarded, disabled)}
        >
          탑승
        </button>
        <button
          type="button"
          onClick={() => {
            if (boarded) onChange(false);
          }}
          disabled={disabled}
          className={segmentedButtonClass(!boarded, disabled)}
        >
          미탑승
        </button>
      </div>
    </div>
  );
}

export function ShopOptionChoice({
  value,
  onChange,
  disabled,
  trailing,
}: {
  value: "lesson" | "rental" | null;
  onChange: (next: "lesson" | "rental" | null) => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-text">샵 이용</p>
        {trailing}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(value === "lesson" ? null : "lesson")}
          disabled={disabled}
          className={segmentedButtonClass(value === "lesson", disabled)}
        >
          강습+장비대여
        </button>
        <button
          type="button"
          onClick={() => onChange(value === "rental" ? null : "rental")}
          disabled={disabled}
          className={segmentedButtonClass(value === "rental", disabled)}
        >
          장비 대여만
        </button>
      </div>
    </div>
  );
}
