"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type NewOrderSignal = {
  readonly sequence: number;
  readonly count: number;
};

function playOrderChime(context: AudioContext): void {
  const startAt = context.currentTime;
  for (const [delay, frequency] of [[0, 880], [0.14, 1174]] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt + delay);
    gain.gain.setValueAtTime(0.0001, startAt + delay);
    gain.gain.exponentialRampToValueAtTime(0.08, startAt + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + delay + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt + delay);
    oscillator.stop(startAt + delay + 0.13);
  }
}

export function ShopOrderSoundAlert({ signal }: { readonly signal: NewOrderSignal }) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const lastSignalSequence = useRef(signal.sequence);

  useEffect(() => () => {
    const context = audioContext.current;
    audioContext.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (signal.sequence === lastSignalSequence.current) return;
    lastSignalSequence.current = signal.sequence;
    if (!enabled) return;

    const context = audioContext.current;
    if (!context) {
      setEnabled(false);
      setError("소리 알림을 다시 켜 주세요.");
      return;
    }

    void (async () => {
      try {
        if (context.state === "suspended") await context.resume();
        if (context.state !== "running") throw new Error("audio context is not running");
        playOrderChime(context);
        setError(null);
      } catch {
        setEnabled(false);
        setError("브라우저가 소리 재생을 멈췄습니다. 다시 켜 주세요.");
      }
    })();
  }, [enabled, signal.sequence]);

  async function enableSound(): Promise<void> {
    try {
      if (typeof window.AudioContext !== "function") {
        setError("이 브라우저에서는 주문 소리 알림을 사용할 수 없습니다.");
        return;
      }
      const context = audioContext.current?.state === "closed"
        ? new window.AudioContext()
        : audioContext.current ?? new window.AudioContext();
      audioContext.current = context;
      if (context.state === "suspended") await context.resume();
      if (context.state !== "running") throw new Error("audio context is not running");
      playOrderChime(context);
      setEnabled(true);
      setError(null);
    } catch {
      setEnabled(false);
      setError("Chrome의 사이트 소리 권한을 확인한 뒤 다시 눌러 주세요.");
    }
  }

  async function disableSound(): Promise<void> {
    setEnabled(false);
    setError(null);
    const context = audioContext.current;
    if (context?.state === "running") await context.suspend().catch(() => undefined);
  }

  return (
    <section aria-labelledby="shop-order-sound-title" className="brand-panel flex items-center gap-3 rounded-2xl px-4 py-3">
      <span className="brand-chip-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" aria-hidden>
        <Icon name={enabled ? "volume_up" : "volume_off"} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold text-brand-text" id="shop-order-sound-title">새 주문 소리</h2>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${enabled ? "brand-chip-success" : "brand-chip-soft"}`}>
            {enabled ? "켜짐" : "꺼짐"}
          </span>
        </div>
        <p className="brand-text-subtle mt-1 break-keep text-xs">
          이 화면을 앞에 열어 둔 동안 새 주문마다 한 번 울립니다.
        </p>
        {error ? <p className="brand-form-error break-keep" role="alert">{error}</p> : null}
      </div>
      <button
        aria-pressed={enabled}
        className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold ${enabled ? "brand-button-secondary" : "brand-button-primary"}`}
        onClick={() => { void (enabled ? disableSound() : enableSound()); }}
        type="button"
      >
        {enabled ? "끄기" : "켜기"}
      </button>
    </section>
  );
}
