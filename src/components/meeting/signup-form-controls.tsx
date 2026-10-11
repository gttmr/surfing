"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatWon } from "@/lib/format";
import type { SignupBurdenPreview } from "@/lib/signup-pricing";

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
    "flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
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
  burden,
}: {
  value: "lesson" | "rental" | null;
  onChange: (next: "lesson" | "rental" | null) => void;
  disabled?: boolean;
  trailing?: ReactNode;
  burden?: SignupBurdenPreview;
}) {
  // 사전 신청은 강사 인원 준비에 필요한 강습 여부만 받는다. 장비·슈트·샤워는 현장 실제 이용으로 기록한다.
  // 예전에 "장비만"으로 신청한 기록(value === "rental")은 "강습 안 함"으로 보인다.
  const choices = [
    { lesson: true, label: "강습 신청", amount: (burden?.baseFee ?? 0) + (burden?.lessonFee ?? 0) },
    { lesson: false, label: "강습 안 함", amount: burden?.baseFee ?? 0 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-text">강습</p>
        {trailing}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {choices.map((choice) => (
          <button
            aria-pressed={(value === "lesson") === choice.lesson}
            className={`${segmentedButtonClass((value === "lesson") === choice.lesson, disabled)} flex-col px-1.5 text-sm leading-5`}
            disabled={disabled}
            key={choice.label}
            onClick={() => onChange(choice.lesson ? "lesson" : null)}
            type="button"
          >
            <span>{choice.label}</span>
            {burden ? <span className="mt-0.5 text-[11px] font-semibold opacity-80">예상 {formatWon(choice.amount)}</span> : null}
          </button>
        ))}
      </div>
      <p className="brand-text-subtle text-[11px] leading-5">장비 대여·슈트·샤워는 현장에서 이용한 만큼 기록되어 청구됩니다. 예상 금액은 참가비와 강습비 기준입니다.</p>
    </div>
  );
}
