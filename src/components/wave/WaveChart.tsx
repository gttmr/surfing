"use client";

import { useState, useEffect } from "react";

// 기본 서핑 스팟 좌표 (고성 송지호 비치)
// 관리자 설정에서 변경 가능하도록 Setting에 surf_lat, surf_lon 추가 가능
const DEFAULT_LAT = 38.331158;
const DEFAULT_LON = 128.52644;

interface WaveData {
  times: string[];
  waveHeight: number[];
  wavePeriod: number[];
  waveDirection: number[];
  windWaveHeight: number[];
}

function DirectionArrow({ degrees }: { degrees: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 inline-block"
      style={{ transform: `rotate(${degrees}deg)` }}
    >
      <path d="M12 2L8 10h3v10h2V10h3L12 2z" fill="currentColor" />
    </svg>
  );
}

function directionLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function MiniLineChart({
  values,
  labels,
  color,
  unit,
}: {
  values: number[];
  labels: string[];
  color: string;
  unit: string;
}) {
  if (values.length === 0) return null;

  const max = Math.max(...values, 0.1);
  const min = 0;
  const range = max - min || 1;

  const width = 280;
  const height = 60;
  const padX = 4;
  const padY = 8;

  const pts = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (v - min) / range) * (height - padY * 2);
    return `${x},${y}`;
  });

  const polyline = pts.join(" ");

  // fill area
  const fillPts = [
    `${padX},${height - padY}`,
    ...pts,
    `${width - padX},${height - padY}`,
  ].join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height: 60 }}>
        <polygon points={fillPts} fill={color} opacity="0.15" />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {values.map((v, i) => {
          const x = padX + (i / (values.length - 1)) * (width - padX * 2);
          const y = padY + (1 - (v - min) / range) * (height - padY * 2);
          return (
            <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
        {labels.filter((_, i) => i % 3 === 0 || i === labels.length - 1).map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mt-0.5 px-1">
        {values.filter((_, i) => i % 3 === 0 || i === values.length - 1).map((v, i) => (
          <span key={i}>{v.toFixed(1)}{unit}</span>
        ))}
      </div>
    </div>
  );
}

export default function WaveChart({ date, location }: { date: string; location: string }) {
  const [data, setData] = useState<WaveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWave() {
      setLoading(true);
      setError(null);
      try {
        const url = new URL("https://marine-api.open-meteo.com/v1/marine");
        url.searchParams.set("latitude", String(DEFAULT_LAT));
        url.searchParams.set("longitude", String(DEFAULT_LON));
        url.searchParams.set("hourly", "wave_height,wave_period,wave_direction,wind_wave_height");
        url.searchParams.set("timezone", "Asia/Seoul");
        url.searchParams.set("start_date", date);
        url.searchParams.set("end_date", date);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("API 오류");

        const json = await res.json();
        const hourly = json.hourly;

        if (!hourly) throw new Error("데이터 없음");

        // 6~20시 (오전 6시 ~ 오후 8시) 구간만
        const times: string[] = hourly.time || [];
        const indices = times
          .map((t: string, i: number) => ({ t, i }))
          .filter(({ t }) => {
            const hour = parseInt(t.split("T")[1]?.split(":")[0] ?? "0");
            return hour >= 6 && hour <= 20;
          })
          .map(({ i }) => i);

        setData({
          times: indices.map((i: number) => {
            const t = times[i];
            return t.split("T")[1]?.slice(0, 5) ?? t;
          }),
          waveHeight: indices.map((i: number) => hourly.wave_height?.[i] ?? 0),
          wavePeriod: indices.map((i: number) => hourly.wave_period?.[i] ?? 0),
          waveDirection: indices.map((i: number) => hourly.wave_direction?.[i] ?? 0),
          windWaveHeight: indices.map((i: number) => hourly.wind_wave_height?.[i] ?? 0),
        });
      } catch (e) {
        setError("파도 정보를 불러올 수 없습니다");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    fetchWave();
  }, [date]);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-blue-200 rounded w-32 mb-3" />
        <div className="h-16 bg-blue-100 rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 text-center">
        🌊 {error ?? "파도 정보를 불러올 수 없습니다"}
      </div>
    );
  }

  const maxWave = Math.max(...data.waveHeight);
  const avgPeriod = data.wavePeriod.reduce((a, b) => a + b, 0) / data.wavePeriod.length;
  const dominantDir = data.waveDirection[Math.floor(data.waveDirection.length / 2)];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-100 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌊</span>
          <h3 className="text-sm font-bold text-slate-800">파도 예보</h3>
        </div>
        <span className="text-[11px] text-slate-400">{location} 기준</span>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/80 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">최고 파고</p>
          <p className="text-lg font-extrabold text-blue-600">{maxWave.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400">m</p>
        </div>
        <div className="bg-white/80 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">평균 주기</p>
          <p className="text-lg font-extrabold text-cyan-600">{avgPeriod.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400">초</p>
        </div>
        <div className="bg-white/80 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">파향</p>
          <p className="text-lg font-extrabold text-teal-600 flex items-center justify-center gap-0.5">
            <DirectionArrow degrees={dominantDir} />
          </p>
          <p className="text-[10px] text-slate-400">{directionLabel(dominantDir)} ({Math.round(dominantDir)}°)</p>
        </div>
      </div>

      {/* 파고 차트 */}
      <div className="bg-white/80 rounded-lg p-3">
        <p className="text-[11px] font-semibold text-slate-600 mb-2">파고 (m) · 06:00–20:00</p>
        <MiniLineChart
          values={data.waveHeight}
          labels={data.times}
          color="#3b82f6"
          unit="m"
        />
      </div>

      {/* 너울/풍랑 */}
      <div className="bg-white/80 rounded-lg p-3">
        <p className="text-[11px] font-semibold text-slate-600 mb-2">풍랑 (m)</p>
        <MiniLineChart
          values={data.windWaveHeight}
          labels={data.times}
          color="#06b6d4"
          unit="m"
        />
      </div>

      <p className="text-[10px] text-slate-400 text-right">
        데이터: Open-Meteo Marine API
      </p>
    </div>
  );
}
