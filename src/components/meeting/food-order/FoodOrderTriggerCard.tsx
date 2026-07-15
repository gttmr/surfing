import { Icon } from "@/components/ui/Icon";
import { formatWon } from "@/lib/format";
import type { ParticipantMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import { getOrderPresentation, getParticipantOrderSubtotal } from "@/lib/participant-order-ui";

export function FoodOrderTriggerCard({
  data,
  onOpen,
}: {
  readonly data: ParticipantMeetingFoodOrdersData;
  readonly onOpen: () => void;
}) {
  const orderable = data.participants.some((participant) => participant.canOrder);
  const participantSubtotals = data.participants.map((participant) => ({
    participant,
    subtotal: getParticipantOrderSubtotal(participant.orders),
  }));
  const subtotal = participantSubtotals.reduce((total, item) => total + item.subtotal, 0);
  const supportApplied = participantSubtotals.reduce(
    (total, item) => total + Math.min(item.subtotal, data.supportCap),
    0,
  );
  const billable = Math.max(0, subtotal - supportApplied);
  const actionLabel = data.meeting.orderOpen && orderable ? "주문하기" : "내역 보기";

  return (
    <button
      aria-label="점심 메뉴 주문 및 내역 열기"
      className="brand-card-soft w-full rounded-3xl p-4 text-left transition-opacity active:opacity-75"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="brand-chip-dark flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"><Icon className="text-[21px]" name="lunch_dining" /></span>
          <div className="min-w-0">
            <p className="text-base font-extrabold text-[var(--brand-text)]">점심 메뉴</p>
            <p className="brand-text-subtle mt-0.5 text-xs">제출별 상태와 변경 내역을 확인합니다.</p>
          </div>
        </div>
        <span className="brand-chip-strong shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{actionLabel}</span>
      </div>

      <div className="mt-3 space-y-2">
        {data.participants.map((participant) => {
          const latest = participant.orders.at(-1);
          const latestStatus = latest ? getOrderPresentation(latest).label : "주문 없음";
          return (
            <div className="brand-panel-white flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5" key={participant.participantId}>
              <p className="min-w-0 break-words text-sm font-bold leading-5 text-[var(--brand-text)]">{participant.name}</p>
              <p className="brand-text-subtle shrink-0 text-xs">{participant.orders.length}건 · {latestStatus}</p>
            </div>
          );
        })}
      </div>

      {subtotal > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--brand-divider)] pt-3 text-xs">
          <span className="brand-text-subtle">지원 {supportApplied > 0 ? `-${formatWon(supportApplied)}` : formatWon(0)}</span>
          <span className={`font-extrabold ${billable > 0 ? "text-[var(--brand-danger)]" : "text-[var(--brand-success-text)]"}`}>청구 {billable > 0 ? formatWon(billable) : "없음"}</span>
        </div>
      ) : null}
    </button>
  );
}
