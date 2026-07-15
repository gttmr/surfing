import { prisma } from "@/lib/db";
import {
  canCancelFoodOrderItems,
  getFoodOrderItemDisplayName,
} from "@/lib/food-ordering";
import type {
  AdminMeetingFoodOrdersData,
  FulfillmentOrderRow,
  FulfillmentOrderStatus,
} from "@/lib/fulfillment-order-types";
import { fulfillmentVariantKey } from "@/lib/fulfillment-order-types";

function orderStatus(items: ReadonlyArray<{
  readonly quantity: number;
  readonly preparingQuantity: number;
  readonly servedQuantity: number;
  readonly cancelledAt: Date | null;
}>): FulfillmentOrderStatus {
  const active = items.filter((item) => item.cancelledAt === null);
  if (active.length === 0) return "cancelled";
  if (active.length !== items.length) return "mixed";
  if (active.every((item) => item.servedQuantity >= item.quantity)) return "served";
  if (active.some((item) => item.servedQuantity > 0)) return "mixed";
  if (active.some((item) => item.preparingQuantity > 0)) return "preparing";
  return "received";
}

function summarizeRows(orderRows: readonly FulfillmentOrderRow[]) {
  const active = orderRows.filter((row) => row.quantity > 0);
  return {
    orderAmount: active.reduce((total, row) => total + row.unitPrice * row.quantity, 0),
    totalOrderedQuantity: active.reduce((total, row) => total + row.quantity, 0),
    remainingQuantity: active.reduce((total, row) => total + row.remainingQuantity, 0),
    cancelledAmount: orderRows.reduce((total, row) => total + row.cancelledAmount, 0),
    cancelledQuantity: orderRows.reduce((total, row) => total + row.cancelledQuantity, 0),
  };
}

function buildMenuRows(orderRows: readonly FulfillmentOrderRow[]): AdminMeetingFoodOrdersData["menuRows"] {
  const grouped = new Map<string, FulfillmentOrderRow[]>();
  for (const row of orderRows) {
    const current = grouped.get(row.menuRowId) ?? [];
    current.push(row);
    grouped.set(row.menuRowId, current);
  }
  return Array.from(grouped, ([rowId, rows]) => {
    const first = rows[0];
    if (!first) throw new Error("fulfillment menu row is empty");
    const active = rows.filter((row) => row.quantity > 0);
    return {
      rowId,
      menuItemId: first.menuItemId,
      orderItemIds: active.flatMap((row) => [...row.orderItemIds]),
      menuName: first.menuName,
      unitPrice: first.unitPrice,
      orderedQuantity: active.reduce((total, row) => total + row.quantity, 0),
      preparingQuantity: active.reduce((total, row) => total + row.preparingQuantity, 0),
      servedQuantity: active.reduce((total, row) => total + row.servedQuantity, 0),
      remainingQuantity: active.reduce((total, row) => total + row.remainingQuantity, 0),
      cancelledQuantity: rows.reduce((total, row) => total + row.cancelledQuantity, 0),
      cancelledAmount: rows.reduce((total, row) => total + row.cancelledAmount, 0),
      participantOrders: active,
    };
  });
}

function buildParticipantRows(orderRows: readonly FulfillmentOrderRow[]): AdminMeetingFoodOrdersData["participantRows"] {
  const grouped = new Map<number, FulfillmentOrderRow[]>();
  for (const row of orderRows) {
    if (row.quantity === 0) continue;
    const current = grouped.get(row.participantId) ?? [];
    current.push(row);
    grouped.set(row.participantId, current);
  }
  return Array.from(grouped, ([participantId, items]) => {
    const first = items[0];
    if (!first) throw new Error("fulfillment participant row is empty");
    return {
      participantId,
      participantName: first.participantName,
      companionId: first.companionId,
      subtotal: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
      items,
    };
  });
}

export async function getAdminMeetingFoodOrdersData(meetingId: number): Promise<AdminMeetingFoodOrdersData | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      location: true,
      participants: {
        where: { status: "APPROVED" },
        orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          companionId: true,
          hasLesson: true,
          hasRental: true,
          foodOrders: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              createdAt: true,
              items: {
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  menuItemId: true,
                  menuOptionChoiceId: true,
                  menuNameSnapshot: true,
                  optionChoiceLabelSnapshot: true,
                  unitPriceSnapshot: true,
                  quantity: true,
                  preparingQuantity: true,
                  servedQuantity: true,
                  cancelledAt: true,
                  cancelledReasonCode: true,
                  cancelledReasonText: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!meeting) return null;

  const orderRows: FulfillmentOrderRow[] = [];
  for (const participant of meeting.participants) {
    for (const order of participant.foodOrders) {
      type OrderItem = (typeof order.items)[number];
      const grouped = new Map<string, OrderItem[]>();
      for (const item of order.items) {
        const key = fulfillmentVariantKey(item);
        const current = grouped.get(key) ?? [];
        current.push(item);
        grouped.set(key, current);
      }
      for (const [key, items] of grouped) {
        const first = items[0];
        if (!first) continue;
        const active = items.filter((item) => item.cancelledAt === null);
        const cancelled = items.filter((item) => item.cancelledAt !== null);
        const quantity = active.reduce((total, item) => total + item.quantity, 0);
        const servedQuantity = active.reduce((total, item) => total + item.servedQuantity, 0);
        orderRows.push({
          rowId: `${order.id}:${key}`,
          menuRowId: `${key}:price:${first.unitPriceSnapshot}`,
          orderId: order.id,
          orderCreatedAt: order.createdAt.toISOString(),
          itemCreatedAt: first.createdAt.toISOString(),
          participantId: participant.id,
          participantName: participant.name,
          companionId: participant.companionId,
          menuItemId: first.menuItemId,
          menuOptionChoiceId: first.menuOptionChoiceId,
          menuName: getFoodOrderItemDisplayName(first),
          unitPrice: first.unitPriceSnapshot,
          orderItemIds: items.map((item) => item.id),
          expectedItems: items.map((item) => ({ id: item.id, updatedAt: item.updatedAt.toISOString() })),
          originalQuantity: items.reduce((total, item) => total + item.quantity, 0),
          quantity,
          preparingQuantity: active.reduce((total, item) => total + item.preparingQuantity, 0),
          servedQuantity,
          remainingQuantity: Math.max(quantity - servedQuantity, 0),
          cancelledQuantity: cancelled.reduce((total, item) => total + item.quantity, 0),
          cancelledAmount: cancelled.reduce((total, item) => total + item.quantity * item.unitPriceSnapshot, 0),
          cancelledReasonCode: cancelled[0]?.cancelledReasonCode ?? null,
          cancelledReasonText: cancelled[0]?.cancelledReasonText ?? null,
          status: orderStatus(items),
          canCancel: canCancelFoodOrderItems(items),
        });
      }
    }
  }

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
    },
    summary: {
      approvedCount: meeting.participants.length,
      lessonCount: meeting.participants.filter((participant) => participant.hasLesson).length,
      rentalCount: meeting.participants.filter((participant) => participant.hasRental).length,
      ...summarizeRows(orderRows),
    },
    orderRows,
    menuRows: buildMenuRows(orderRows),
    participantRows: buildParticipantRows(orderRows),
  };
}
