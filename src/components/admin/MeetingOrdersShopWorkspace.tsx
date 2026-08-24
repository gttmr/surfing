import type { AdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import { formatWon } from "@/lib/format";
import { MeetingOrdersShopMenuBoard } from "./MeetingOrdersShopMenuBoard";
import type { ActionHandler, CancelRequestHandler } from "./meeting-orders-workspace-types";

function ShopSummaryBar({ data }: { readonly data: AdminMeetingFoodOrdersData }) {
  const preparingQuantity = data.menuRows.reduce((sum, menu) => sum + menu.preparingQuantity, 0);
  const completedQuantity = data.menuRows.reduce((sum, menu) => sum + menu.servedQuantity, 0);

  const chips = [
    { label: "판매수량", value: data.summary.totalOrderedQuantity, className: "brand-chip-soft" },
    { label: "준비 중", value: preparingQuantity, className: "brand-chip-preparing" },
    { label: "완료", value: completedQuantity, className: "brand-chip-dark" },
  ];

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="brand-chip-soft rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold opacity-70">판매 합계</p>
          <p className="mt-0.5 text-[1.35rem] font-extrabold tracking-[-0.03em]">{formatWon(data.summary.orderAmount)}</p>
        </div>
        <div className="brand-chip-danger rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold opacity-70">취소 금액</p>
          <p className="mt-0.5 text-[1.35rem] font-extrabold tracking-[-0.03em]">{formatWon(data.summary.cancelledAmount)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {chips.map(({ label, value, className }) => (
          <div
            key={label}
            className={`flex flex-1 flex-col items-center rounded-2xl px-3 py-3 ${className}`}
          >
            <p className="text-[11px] font-bold opacity-70">{label}</p>
            <p className="mt-0.5 text-[1.25rem] font-extrabold tracking-[-0.03em]">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShopMenuSalesTable({ data }: { readonly data: AdminMeetingFoodOrdersData }) {
  const rows = data.menuRows.filter((menu) => menu.orderedQuantity > 0 || menu.cancelledQuantity > 0);

  if (rows.length === 0) return null;

  return (
    <section className="brand-panel-white overflow-hidden rounded-[1.7rem]">
      <div className="grid grid-cols-[minmax(0,1fr)_3rem_5.5rem] gap-2 px-4 py-3 text-[11px] font-extrabold text-brand-text-subtle">
        <span>메뉴</span>
        <span className="text-right">수량</span>
        <span className="text-right">금액</span>
      </div>
      {rows.map((menu) => (
        <div
          key={menu.rowId}
          className="grid grid-cols-[minmax(0,1fr)_3rem_5.5rem] gap-2 border-t border-brand-divider px-4 py-3 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-bold text-brand-text">{menu.menuName}</p>
            {menu.cancelledQuantity > 0 ? (
              <p className="brand-text-subtle mt-0.5 text-[11px]">취소 {menu.cancelledQuantity}개 · {formatWon(menu.cancelledAmount)}</p>
            ) : null}
          </div>
          <span className="text-right font-bold text-brand-text">{menu.orderedQuantity}</span>
          <span className="text-right font-bold text-brand-text">
            {formatWon(menu.unitPrice * menu.orderedQuantity)}
          </span>
        </div>
      ))}
    </section>
  );
}

export function MeetingOrdersShopWorkspace({
  data,
  submittingRows,
  onAction,
  onRequestCancel,
}: {
  readonly data: AdminMeetingFoodOrdersData;
  readonly submittingRows: ReadonlySet<string>;
  readonly onAction: ActionHandler;
  readonly onRequestCancel: CancelRequestHandler;
}) {
  return (
    <div className="space-y-6">
      <ShopSummaryBar data={data} />
      <ShopMenuSalesTable data={data} />
      <MeetingOrdersShopMenuBoard
        data={data}
        submittingRows={submittingRows}
        onAction={onAction}
        onRequestCancel={onRequestCancel}
      />
    </div>
  );
}
