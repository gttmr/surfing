import type { AdminSettlementData } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";

function AmountRow({
  label,
  value,
  detail,
  sign = "+",
}: {
  readonly label: string;
  readonly value: number;
  readonly detail?: string;
  readonly sign?: "+" | "−";
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-sm font-bold text-brand-text">{label}</dt>
        {detail ? <p className="brand-text-subtle mt-0.5 truncate text-[11px]">{detail}</p> : null}
      </div>
      <dd className="shrink-0 text-base font-extrabold tabular-nums text-brand-text">{sign === "−" ? "− " : ""}{formatWon(value)}</dd>
    </div>
  );
}

export function AdminMeetingSettlementOverview({
  data,
  reloading,
}: {
  readonly data: AdminSettlementData;
  readonly reloading: boolean;
}) {
  const { billing } = data;
  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="brand-admin-section-header w-full px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-brand-text">{data.meeting.overnightGroup ? "1박 2일 합산 금액" : "금액 구분"}</h2>
            {reloading ? <span className="brand-text-subtle text-xs">갱신 중</span> : null}
          </div>
          <p className="brand-text-muted mt-1 break-keep text-xs">
            {data.meeting.overnightGroup
              ? "기본 참가비와 선택한 숙박비는 한 번, 두 날짜의 실제 이용·식음료·조정은 모두 합산했습니다."
              : "장비와 식음료는 같은 샵에 한 번에 지급합니다."}
          </p>
        </div>
      </div>
      <dl className="divide-y divide-brand-divider px-4">
        <AmountRow label="회원 입금" value={billing.totals.memberChargeTotal} />
        <AmountRow
          detail={`정회원 ${billing.companySupport.regularCount}명 × ${formatWon(billing.companySupport.perRegular)}`}
          label="회사 지원금"
          value={billing.companySupport.total}
        />
        <AmountRow
          detail={`장비 ${formatWon(billing.totals.shopPayableTotal)} + 식음료 ${formatWon(billing.totals.foodPayableTotal)}`}
          label="샵 지급"
          sign="−"
          value={billing.shopTotal.payable}
        />
      </dl>
      <div className="flex items-center justify-between gap-3 border-t-2 border-brand-divider px-4 py-3">
        <div>
          <p className="text-sm font-extrabold text-brand-text">{billing.balance >= 0 ? "샵 지급 후 잔액" : "샵 지급 후 부족액"}</p>
          <p className="brand-text-subtle text-[11px]">숙소·버스 등 앱 밖 비용은 빠져 있습니다.</p>
        </div>
        <p className={`text-xl font-extrabold ${billing.balance >= 0 ? "text-brand-text" : "text-brand-danger"}`}>{formatWon(Math.abs(billing.balance))}</p>
      </div>
    </section>
  );
}
