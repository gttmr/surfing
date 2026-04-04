"use client";

import { useEffect, useState } from "react";

const DEFAULT_LAT = 38.331158;
const DEFAULT_LON = 128.52644;

type ForecastSummary = {
  swell: number;
  period: number;
  direction: number;
  windWave: number;
};

function arrowLabel(degrees: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(degrees / 45) % 8];
}

function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={`material-symbols-outlined leading-none ${className}`}>
      {name}
    </span>
  );
}

function ForecastCard({
  icon,
  label,
  value,
  suffix,
  meta,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  suffix?: string;
  meta?: string;
  accent?: boolean;
}) {
  return (
    <article className="rounded-2xl bg-[#f9f9f9] p-2.5 shadow-[inset_0_0_0_1px_rgba(205,199,170,0.12)]">
      <div className="mb-2 flex justify-between">
        <Icon className={`text-[18px] ${accent ? "text-[var(--brand-primary-text)]" : "text-[var(--brand-primary-text-strong)]"}`} name={icon} />
      </div>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.28em] text-[#4b4732]/40">{label}</p>
      <div className="flex items-baseline gap-1">
        <h3 className="font-headline text-[1.5rem] font-extrabold leading-none tracking-[-0.05em]">{value}</h3>
        {suffix ? <span className="text-xs font-medium text-[#4b4732]/60">{suffix}</span> : null}
      </div>
      {meta ? <p className="mt-1.5 text-[11px] font-semibold text-[#4b4732]/60">{meta}</p> : null}
    </article>
  );
}

export default function WaveForecastSummary({
  date,
  location,
}: {
  date: string;
  location: string;
}) {
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchForecast() {
      setLoading(true);
      setError(false);

      try {
        const url = new URL("https://marine-api.open-meteo.com/v1/marine");
        url.searchParams.set("latitude", String(DEFAULT_LAT));
        url.searchParams.set("longitude", String(DEFAULT_LON));
        url.searchParams.set("hourly", "wave_height,wave_period,wave_direction,wind_wave_height");
        url.searchParams.set("timezone", "Asia/Seoul");
        url.searchParams.set("start_date", date);
        url.searchParams.set("end_date", date);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("forecast fetch failed");

        const json = await res.json();
        const hourly = json.hourly;
        if (!hourly?.time?.length) throw new Error("missing hourly data");

        const indices = hourly.time
          .map((time: string, index: number) => ({ time, index }))
          .filter(({ time }: { time: string }) => {
            const hour = parseInt(time.split("T")[1]?.split(":")[0] ?? "0", 10);
            return hour >= 6 && hour <= 20;
          })
          .map(({ index }: { index: number }) => index);

        if (!indices.length) throw new Error("no daytime forecast");

        const waveHeight = indices.map((index: number) => hourly.wave_height?.[index] ?? 0);
        const wavePeriod = indices.map((index: number) => hourly.wave_period?.[index] ?? 0);
        const waveDirection = indices.map((index: number) => hourly.wave_direction?.[index] ?? 0);
        const windWaveHeight = indices.map((index: number) => hourly.wind_wave_height?.[index] ?? 0);

        const nextSummary = {
          swell: Math.max(...waveHeight),
          period: wavePeriod.reduce((sum: number, value: number) => sum + value, 0) / wavePeriod.length,
          direction: waveDirection[Math.floor(waveDirection.length / 2)] ?? 0,
          windWave: Math.max(...windWaveHeight),
        };

        if (!cancelled) setSummary(nextSummary);
      } catch {
        if (!cancelled) {
          setSummary(null);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchForecast();

    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <section>
      <div className="mb-2.5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-base font-bold tracking-[-0.03em]">파도 예보</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[#4b4732]/55">{location} · {date}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-[88px] animate-pulse rounded-2xl bg-[#f3f3f3]" />
          ))}
        </div>
      ) : error || !summary ? (
        <div className="rounded-2xl bg-[#f9f9f9] px-3 py-3 text-sm font-medium text-[#4b4732]/70 shadow-[inset_0_0_0_1px_rgba(205,199,170,0.12)]">
          아직 예보가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <ForecastCard accent icon="water" label="SWELL" value={summary.swell.toFixed(1)} suffix="m" />
          <ForecastCard icon="timer" label="PERIOD" value={summary.period.toFixed(1)} suffix="s" />
          <ForecastCard icon="air" label="WIND WAVE" meta={arrowLabel(summary.direction)} value={summary.windWave.toFixed(1)} suffix="m" />
        </div>
      )}
    </section>
  );
}
