"use client";

interface CapacityBarProps {
  current: number;
  max: number;
  waitlisted?: number;
  showLabel?: boolean;
}

export function CapacityBar({ current, max, waitlisted = 0, showLabel = true }: CapacityBarProps) {
  const ratio = max > 0 ? current / max : 0;
  const pct = Math.min(ratio * 100, 100);

  let barColor = "bg-green-500";
  let textColor = "text-green-700";
  let label = "";

  if (ratio >= 1) {
    barColor = "bg-red-500";
    textColor = "text-red-700";
    label = "정원 마감";
  } else if (ratio >= 0.85) {
    barColor = "bg-red-400";
    textColor = "text-red-600";
    label = "마감 임박";
  } else if (ratio >= 0.6) {
    barColor = "bg-amber-400";
    textColor = "text-amber-700";
  }

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">
            정원 <span className="font-semibold text-slate-800">{current}</span>/{max}명
            {waitlisted > 0 && (
              <span className="ml-1.5 text-amber-600 text-xs font-semibold">· 대기 {waitlisted}명</span>
            )}
          </span>
          {label && (
            <span className={`text-xs font-semibold ${textColor}`}>{label}</span>
          )}
        </div>
      )}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && ratio < 1 && (
        <p className="text-xs text-slate-500">잔여 {max - current}자리</p>
      )}
    </div>
  );
}
