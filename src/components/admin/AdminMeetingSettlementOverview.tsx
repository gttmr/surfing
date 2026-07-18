import type { AdminSettlementData } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";

export function AdminMeetingSettlementOverview({
  data,
  showAmounts,
  reloading,
}: {
  readonly data: AdminSettlementData;
  readonly showAmounts: boolean;
  readonly reloading: boolean;
}) {
  const pageTotal = data.recipients.reduce((total, recipient) => total + recipient.totalFee, 0);
  const pendingCount = data.recipients.filter((recipient) => !recipient.completed).length;
  const completedCount = data.recipients.length - pendingCount;

  return (
    <section className="brand-card-soft rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[var(--brand-text)]">정산 현황</h2>
          <p className="brand-text-muted mt-1 text-xs">
            {showAmounts ? "페이지 전체 금액과 수신자별 처리 상태를 한 번에 확인합니다." : "정산을 열면 금액을 확인할 수 있습니다."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`${showAmounts ? "brand-chip-dark" : "brand-chip-soft"} rounded-full px-2 py-1 text-xs font-bold`}>
            {showAmounts ? "정산 오픈" : "정산 준비 중"}
          </span>
          {reloading ? <span className="brand-text-subtle text-xs">갱신 중...</span> : null}
        </div>
      </div>

      <div className="brand-panel-strong mt-4 rounded-3xl p-4">
        <p className="brand-text-subtle text-xs font-bold">페이지 전체 정산</p>
        <p className="mt-1 text-[1.7rem] font-extrabold tracking-[-0.04em] text-[var(--brand-text)]">
          {showAmounts ? formatWon(pageTotal) : "금액 비공개"}
        </p>
        <p className="brand-text-muted mt-1 text-xs">
          {showAmounts
            ? `수신자 ${data.recipients.length}명 · 정산 대기 ${pendingCount}명 · 송금 완료 ${completedCount}명`
            : "정산 준비 중 · 금액 비공개"}
        </p>
      </div>

      {showAmounts && data.surfUsageSummary.shopChargeAmount > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="brand-panel-white rounded-2xl px-3 py-3">
            <p className="brand-text-subtle text-[11px] font-bold">샵 청구</p>
            <p className="mt-1 text-sm font-extrabold text-[var(--brand-text)]">{formatWon(data.surfUsageSummary.shopChargeAmount)}</p>
          </div>
          <div className="brand-panel-white rounded-2xl px-3 py-3">
            <p className="brand-text-subtle text-[11px] font-bold">회원 청구</p>
            <p className="mt-1 text-sm font-extrabold text-[var(--brand-text)]">{formatWon(data.surfUsageSummary.memberChargeAmount)}</p>
          </div>
          <div className="brand-panel-white rounded-2xl px-3 py-3">
            <p className="brand-text-subtle text-[11px] font-bold">운영 부담</p>
            <p className="mt-1 text-sm font-extrabold text-[var(--brand-text)]">{formatWon(data.surfUsageSummary.operationsCoveredAmount)}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
