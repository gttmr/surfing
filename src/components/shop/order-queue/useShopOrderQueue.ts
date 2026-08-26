"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { FulfillmentOrderAction } from "@/lib/fulfillment-order-action";
import type { AdminMeetingFoodOrdersData, FulfillmentOrderRow } from "@/lib/fulfillment-order-types";
import { findNewActiveOrderIds, type ShopOrderFilter } from "@/lib/shop-order-queue";
import type { ShopOrderActionHandler, ShopOrderActionOptions } from "./types";

const ACTION_SUCCESS: Record<FulfillmentOrderAction, string> = {
  prepare: "준비를 시작했습니다.",
  serve: "전달 완료로 표시했습니다.",
  undo_prepare: "준비 상태를 되돌렸습니다.",
  undo_serve: "완료 처리를 되돌렸습니다.",
  cancel: "주문을 취소했습니다.",
};

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

function errorMessage(value: unknown): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "주문 목록을 불러오지 못했습니다.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useShopOrderQueue(input: {
  readonly initialData: AdminMeetingFoodOrdersData;
  readonly ordersEndpoint: string;
}) {
  const [data, setData] = useState(input.initialData);
  const [filter, setFilter] = useState<ShopOrderFilter>("active");
  const [query, setQuery] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newOrderSignal, setNewOrderSignal] = useState({ sequence: 0, count: 0 });
  const [lockedRows, setLockedRows] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(true);
  const activeRead = useRef<AbortController | null>(null);
  const inFlightRows = useRef(new Set<string>());
  const mutationEpoch = useRef(0);
  const mutationSequence = useRef(0);
  const appliedMutation = useRef(0);
  const knownOrderIds = useRef(new Set(input.initialData.orderRows.map((row) => row.orderId)));
  const { addToast, removeToast, toasts } = useToast();

  const commitData = useCallback((next: AdminMeetingFoodOrdersData) => {
    const newOrderIds = findNewActiveOrderIds(next.orderRows, knownOrderIds.current);
    for (const row of next.orderRows) knownOrderIds.current.add(row.orderId);
    if (newOrderIds.length > 0) {
      setNewOrderSignal((current) => ({ sequence: current.sequence + 1, count: newOrderIds.length }));
      setNotice(`새 주문 ${newOrderIds.length}건이 들어왔습니다.`);
    }
    setData(next);
    setLastUpdatedAt(Date.now());
    setRefreshError(null);
  }, []);

  const refresh = useCallback(async (source: "interval" | "visibility" | "manual" | "mutation") => {
    if (inFlightRows.current.size > 0) return;
    if (source === "interval" && document.visibilityState !== "visible") return;
    const epoch = mutationEpoch.current;
    activeRead.current?.abort();
    const controller = new AbortController();
    activeRead.current = controller;
    setRefreshing(true);
    try {
      const response = await fetch(input.ordersEndpoint, { cache: "no-store", signal: controller.signal });
      const payload: unknown = await response.json();
      if (!response.ok || !isOrdersData(payload)) throw new Error(errorMessage(payload));
      if (activeRead.current !== controller || mutationEpoch.current !== epoch) return;
      commitData(payload);
    } catch (error) {
      if (!isAbortError(error) && activeRead.current === controller) {
        setRefreshError(error instanceof Error ? error.message : "주문 목록을 불러오지 못했습니다.");
      }
    } finally {
      if (activeRead.current === controller) {
        activeRead.current = null;
        setRefreshing(false);
      }
    }
  }, [commitData, input.ordersEndpoint]);

  useEffect(() => {
    activeRead.current?.abort();
    mutationEpoch.current += 1;
    inFlightRows.current.clear();
    setLockedRows(new Set());
    setData(input.initialData);
    setFilter("active");
    setQuery("");
    setNotice(null);
    setNewOrderSignal({ sequence: 0, count: 0 });
    setRefreshError(null);
    setLastUpdatedAt(Date.now());
    knownOrderIds.current = new Set(input.initialData.orderRows.map((row) => row.orderId));
  }, [input.initialData]);

  useEffect(() => {
    let previous = document.visibilityState === "visible";
    setVisible(previous);
    const handleVisibility = () => {
      const next = document.visibilityState === "visible";
      setVisible(next);
      if (!previous && next) void refresh("visibility");
      previous = next;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refresh]);

  useEffect(() => {
    if (!visible) return;
    const interval = window.setInterval(() => { void refresh("interval"); }, 5_000);
    return () => window.clearInterval(interval);
  }, [refresh, visible]);

  useEffect(() => () => {
    activeRead.current?.abort();
    mutationEpoch.current += 1;
  }, []);

  const mutate: ShopOrderActionHandler = async (
    row: FulfillmentOrderRow,
    action: FulfillmentOrderAction,
    options: ShopOrderActionOptions = {},
  ) => {
    if (inFlightRows.current.has(row.rowId)) return "error";
    inFlightRows.current.add(row.rowId);
    setLockedRows(new Set(inFlightRows.current));
    mutationEpoch.current += 1;
    activeRead.current?.abort();
    activeRead.current = null;
    setRefreshing(false);
    setNotice(null);
    const requestId = ++mutationSequence.current;
    try {
      const response = await fetch(input.ordersEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderItemIds: row.orderItemIds,
          expectedItems: row.expectedItems,
          ...options,
        }),
      });
      const payload: unknown = await response.json();
      if (response.status === 409 && isRecord(payload) && isOrdersData(payload.current)) {
        if (requestId >= appliedMutation.current) {
          appliedMutation.current = requestId;
          commitData(payload.current);
          setNotice("다른 화면에서 주문 상태가 바뀌어 최신 목록으로 갱신했습니다.");
        }
        addToast(errorMessage(payload), "info");
        return "conflict";
      }
      if (!response.ok) throw new Error(errorMessage(payload));
      if (!isRecord(payload) || !isOrdersData(payload.data)) throw new Error("주문 응답을 확인하지 못했습니다.");
      if (requestId >= appliedMutation.current) {
        appliedMutation.current = requestId;
        commitData(payload.data);
      }
      addToast(ACTION_SUCCESS[action], "success");
      return "success";
    } catch (error) {
      addToast(error instanceof Error ? error.message : "주문 상태를 바꾸지 못했습니다.", "error");
      return "error";
    } finally {
      inFlightRows.current.delete(row.rowId);
      setLockedRows(new Set(inFlightRows.current));
      if (inFlightRows.current.size === 0) void refresh("mutation");
    }
  };

  return {
    data,
    filter,
    lastUpdatedAt,
    lockedRows,
    mutate,
    newOrderSignal,
    notice,
    query,
    refresh,
    refreshError,
    refreshing,
    removeToast,
    setFilter,
    setNotice,
    setQuery,
    toasts,
  };
}
