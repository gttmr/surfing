"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addParticipantOrder,
  loadParticipantOrders,
  mutateParticipantOrder,
} from "@/components/meeting/food-order/food-order-client";
import type { ParticipantFoodOrderData, ParticipantMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import {
  buildOrderMenuVariants,
  expectedItemsForOrder,
  getOrderCartSummary,
  getOrderPresentation,
  getParticipantOrderSubtotal,
  prefillOrderDraft,
  selectedOrderLines,
} from "@/lib/participant-order-ui";

type Editor = { readonly kind: "add" } | { readonly kind: "edit"; readonly orderId: number };
type View = "history" | "discover" | "review";
type Drafts = Record<number, Record<string, number>>;
type ConflictDraft = {
  readonly participantId: number;
  readonly orderId: number | null;
  readonly values: Record<string, number>;
};

const EMPTY_DRAFT: Record<string, number> = {};

function ordersForParticipant(data: ParticipantMeetingFoodOrdersData | null, participantId: number | null) {
  return data?.participants.find((participant) => participant.participantId === participantId)?.orders ?? [];
}

export function useMeetingFoodOrder(meetingId: number) {
  const [data, setData] = useState<ParticipantMeetingFoodOrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [view, setView] = useState<View>("history");
  const [editor, setEditor] = useState<Editor>({ kind: "add" });
  const [drafts, setDrafts] = useState<Drafts>({});
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [conflictDraft, setConflictDraft] = useState<ConflictDraft | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ParticipantFoodOrderData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await loadParticipantOrders(meetingId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "주문 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { void load(); }, [load]);

  const variants = useMemo(() => buildOrderMenuVariants(data?.menus ?? []), [data]);
  const selectedParticipant = data?.participants.find(
    (participant) => participant.participantId === selectedParticipantId,
  ) ?? null;
  const selectedOrders = ordersForParticipant(data, selectedParticipantId);
  const draft = selectedParticipantId === null ? EMPTY_DRAFT : drafts[selectedParticipantId] ?? EMPTY_DRAFT;
  const lines = useMemo(() => selectedOrderLines(variants, draft), [draft, variants]);
  const editedOrderId = editor.kind === "edit" ? editor.orderId : null;
  const existingSubtotal = getParticipantOrderSubtotal(selectedOrders, editedOrderId);
  const summary = getOrderCartSummary(lines, data?.supportCap ?? 0, existingSubtotal);

  function chooseParticipant(participantId: number) {
    setSelectedParticipantId(participantId);
    setMessage("");
    setNotice("");
    setEditor({ kind: "add" });
    const orders = ordersForParticipant(data, participantId);
    setView(orders.length > 0 ? "history" : "discover");
  }

  function showPanel() {
    if (!data) return;
    const participant = data.participants.find((item) => item.canOrder) ?? data.participants[0];
    if (!participant) return;
    setSelectedParticipantId(participant.participantId);
    setView(participant.orders.length > 0 ? "history" : "discover");
    setEditor({ kind: "add" });
    setMessage("");
    setNotice("");
    setOpen(true);
  }

  function startAdd(values: Record<string, number> = {}) {
    if (!selectedParticipant?.canOrder) return;
    setDrafts((current) => ({ ...current, [selectedParticipant.participantId]: values }));
    setEditor({ kind: "add" });
    setView("discover");
    setSelectedOnly(false);
    setMessage("");
    setNotice(values && Object.keys(values).length > 0 ? "보관한 선택을 새 주문으로 다시 담았습니다." : "");
  }

  function startEdit(order: ParticipantFoodOrderData, values?: Record<string, number>) {
    if (!selectedParticipant?.canOrder || !getOrderPresentation(order).editable) return;
    setDrafts((current) => ({
      ...current,
      [selectedParticipant.participantId]: values ?? prefillOrderDraft(variants, order),
    }));
    setEditor({ kind: "edit", orderId: order.orderId });
    setView("discover");
    setSelectedOnly(false);
    setMessage("");
    setNotice("");
  }

  function updateQuantity(key: string, quantity: number) {
    if (!selectedParticipant || saving) return;
    setDrafts((current) => ({
      ...current,
      [selectedParticipant.participantId]: {
        ...(current[selectedParticipant.participantId] ?? {}),
        [key]: Math.max(0, quantity),
      },
    }));
  }

  async function submit() {
    if (!data || !selectedParticipant?.canOrder || lines.length === 0 || saving) return;
    setSaving(true);
    setMessage("");
    const items = lines.map((line) => ({
      menuItemId: line.menuId,
      optionChoiceId: line.optionChoiceId,
      quantity: line.quantity,
    }));
    const currentEditor = editor;
    const result = currentEditor.kind === "add"
      ? await addParticipantOrder({ meetingId, participantId: selectedParticipant.participantId, items })
      : await mutateParticipantOrder({
          meetingId,
          orderId: currentEditor.orderId,
          method: "PATCH",
          body: {
            replacementItems: items,
            expectedItems: expectedItemsForOrder(
              selectedOrders.find((order) => order.orderId === currentEditor.orderId) ?? { orderId: currentEditor.orderId, createdAt: "", items: [] },
            ),
          },
        });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      if (result.status === 409 && result.current) {
        setConflictDraft({ participantId: selectedParticipant.participantId, orderId: editedOrderId, values: { ...draft } });
        setData(result.current);
        setView("history");
      }
      return;
    }
    setData(result.data);
    setDrafts((current) => ({ ...current, [selectedParticipant.participantId]: {} }));
    setView("history");
    setNotice(currentEditor.kind === "edit" ? "주문을 수정했습니다." : "새 주문을 접수했습니다.");
    setConflictDraft(null);
  }

  async function confirmCancel() {
    if (!cancelTarget || saving) return;
    setSaving(true);
    setMessage("");
    const result = await mutateParticipantOrder({
      meetingId,
      orderId: cancelTarget.orderId,
      method: "DELETE",
      body: { expectedItems: expectedItemsForOrder(cancelTarget) },
    });
    setSaving(false);
    setCancelTarget(null);
    if (!result.ok) {
      setMessage(result.message);
      if (result.status === 409 && result.current) setData(result.current);
      return;
    }
    setData(result.data);
    setNotice("주문을 취소했습니다. 취소 내역은 그대로 보관됩니다.");
  }

  function reapplyConflict() {
    if (!conflictDraft || !data) return;
    const participant = data.participants.find((item) => item.participantId === conflictDraft.participantId);
    if (!participant) return;
    setSelectedParticipantId(participant.participantId);
    const currentOrder = participant.orders.find((order) => order.orderId === conflictDraft.orderId);
    setConflictDraft(null);
    if (currentOrder && getOrderPresentation(currentOrder).editable) startEdit(currentOrder, conflictDraft.values);
    else startAdd(conflictDraft.values);
  }

  return {
    data, loading, loadError, load, open, setOpen, showPanel,
    selectedParticipant, selectedParticipantId, chooseParticipant, selectedOrders,
    view, setView, editor, variants, draft, lines, summary, query, setQuery,
    selectedOnly, setSelectedOnly, updateQuantity, startAdd, startEdit, submit,
    saving, message, setMessage, notice, conflictDraft, reapplyConflict,
    cancelTarget, setCancelTarget, confirmCancel,
  };
}
