"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import type { FulfillmentOrderRow } from "@/lib/fulfillment-order-types";
import { MeetingOrdersAdminWorkspace } from "./MeetingOrdersAdminWorkspace";
import { MeetingOrdersShopWorkspace } from "./MeetingOrdersShopWorkspace";
import type { CancelTarget, OrderActionOptions } from "./meeting-orders-workspace-types";

const CANCEL_REASONS = [
  { code: "sold_out", label: "품절" },
  { code: "duplicate", label: "중복 주문" },
  { code: "customer_request", label: "고객 요청" },
  { code: "other", label: "기타" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrdersData(value: unknown): value is AdminMeetingFoodOrdersData {
  return isRecord(value)
    && isRecord(value.meeting)
    && isRecord(value.summary)
    && Array.isArray(value.orderRows)
    && Array.isArray(value.menuRows)
    && Array.isArray(value.participantRows);
}

function responseError(value: unknown): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "주문 상태를 바꾸지 못했습니다.";
}

function CancelOrderDialog({
  target,
  submitting,
  onClose,
  onConfirm,
}: {
  readonly target: CancelTarget;
  readonly submitting: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (target: NonNullable<CancelTarget>, options: OrderActionOptions) => void;
}) {
  const [reasonCode, setReasonCode] = useState(CANCEL_REASONS[0].code);
  const [reasonText, setReasonText] = useState("");

  return (
    <Dialog
      closeLabel="주문 취소 창 닫기"
      description={target?.label}
      onClose={onClose}
      open={Boolean(target)}
      title="주문 취소"
    >
      {target ? (
        <>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs font-bold text-brand-text">취소 사유</span>
            <select
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              className="brand-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
            >
              {CANCEL_REASONS.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-brand-text">추가 설명</span>
            <textarea
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value.slice(0, 100))}
              className="brand-input min-h-20 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
              placeholder="필요한 경우 사용자에게 보일 설명을 입력하세요."
            />
          </label>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="brand-button-secondary rounded-2xl px-4 py-3 text-sm font-bold"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => onConfirm(target, { reasonCode, reasonText })}
              disabled={submitting}
              className="brand-button-danger-solid rounded-2xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
            >
              {submitting ? "취소 중..." : "주문 취소"}
            </button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

export function MeetingOrdersWorkspace({
  initialData,
  ordersEndpoint,
  variant = "admin",
  onDataChange,
}: {
  readonly initialData: AdminMeetingFoodOrdersData;
  readonly ordersEndpoint: string;
  readonly variant?: "admin" | "shop";
  readonly onDataChange?: (nextData: AdminMeetingFoodOrdersData) => void;
}) {
  const [data, setData] = useState(initialData);
  const inFlightRows = useRef(new Set<string>());
  const [submittingRows, setSubmittingRows] = useState<Set<string>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<CancelTarget>(null);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    setData(initialData);
    inFlightRows.current.clear();
    setSubmittingRows(new Set());
    setCancelTarget(null);
  }, [initialData]);

  async function handleAction(
    row: FulfillmentOrderRow,
    action: "prepare" | "serve" | "undo_prepare" | "undo_serve" | "cancel",
    options: OrderActionOptions = {}
  ) {
    if (inFlightRows.current.has(row.rowId)) return;
    inFlightRows.current.add(row.rowId);
    setSubmittingRows(new Set(inFlightRows.current));
    try {
      const res = await fetch(ordersEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderItemIds: row.orderItemIds,
          expectedItems: row.expectedItems,
          ...options,
        }),
      });
      const next: unknown = await res.json();
      if (!res.ok) {
        if (res.status === 409 && isRecord(next) && isOrdersData(next.current)) {
          setData(next.current);
          onDataChange?.(next.current);
        }
        throw new Error(responseError(next));
      }
      if (!isRecord(next) || !isOrdersData(next.data)) throw new Error("주문 응답을 확인하지 못했습니다.");
      const nextData = next.data;
      setData(nextData);
      onDataChange?.(nextData);
      if (action === "cancel") {
        setCancelTarget(null);
        addToast("주문을 취소했습니다", "success");
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "주문 상태를 바꾸지 못했습니다.", "error");
    } finally {
      inFlightRows.current.delete(row.rowId);
      setSubmittingRows(new Set(inFlightRows.current));
    }
  }

  return (
    <>
      {variant === "shop" ? (
        <MeetingOrdersShopWorkspace
          data={data}
          submittingRows={submittingRows}
          onAction={handleAction}
          onRequestCancel={setCancelTarget}
        />
      ) : (
        <MeetingOrdersAdminWorkspace
          data={data}
          submittingRows={submittingRows}
          onAction={handleAction}
          onRequestCancel={setCancelTarget}
        />
      )}
      <CancelOrderDialog
        key={cancelTarget ? cancelTarget.row.rowId : "closed"}
        target={cancelTarget}
        submitting={cancelTarget ? submittingRows.has(cancelTarget.row.rowId) : false}
        onClose={() => setCancelTarget(null)}
        onConfirm={(target, options) => {
          void handleAction(target.row, "cancel", options);
        }}
      />
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </>
  );
}
