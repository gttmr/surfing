import type { AdminSettlementData } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";

export function AdminMeetingSettlementOverview({
  data,
  reloading,
}: {
  readonly data: AdminSettlementData;
  readonly reloading: boolean;
}) {
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
              : "받을 돈과 지급할 돈을 합치지 않고 각각 확인합니다."}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-brand-divider">
        <div className="bg-brand-surface-elevated px-4 py-4">
          <dt className="brand-text-subtle text-xs font-bold">회원에게 받을 금액</dt>
          <dd className="mt-1 text-lg font-extrabold text-brand-text">{formatWon(data.billing.totals.memberChargeTotal)}</dd>
        </div>
        <div className="bg-brand-surface-elevated px-4 py-4">
          <dt className="brand-text-subtle text-xs font-bold">샵에 지급할 금액</dt>
          <dd className="mt-1 text-lg font-extrabold text-brand-text">{formatWon(data.billing.totals.shopPayableTotal)}</dd>
        </div>
        <div className="bg-brand-surface-elevated px-4 py-4">
          <dt className="brand-text-subtle text-xs font-bold">식음료 지급액</dt>
          <dd className="mt-1 text-lg font-extrabold text-brand-text">{formatWon(data.billing.totals.foodPayableTotal)}</dd>
        </div>
        <div className="bg-brand-surface-elevated px-4 py-4">
          <dt className="brand-text-subtle text-xs font-bold">동호회 지원액</dt>
          <dd className="mt-1 text-lg font-extrabold text-brand-text">{formatWon(data.billing.totals.clubSupportTotal)}</dd>
        </div>
      </dl>
    </section>
  );
}
