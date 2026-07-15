import { Prisma } from "@prisma/client";
import {
  getFulfillmentItemUpdates,
  ORDER_CANCEL_REASON_LABELS,
  parseFulfillmentOrderAction,
  type FulfillmentOrderMutation,
} from "@/lib/fulfillment-order-action";
import { fulfillmentVariantKey } from "@/lib/fulfillment-order-types";
import { runSerializableTransaction } from "@/lib/transaction";

export type FulfillmentOrderActionResult =
  | { readonly kind: "success" }
  | { readonly kind: "invalid" }
  | { readonly kind: "not_found" }
  | { readonly kind: "conflict" };

class FulfillmentWriteConflictError extends Error {
  readonly name = "FulfillmentWriteConflictError";
}

function sameIds(actual: readonly number[], expected: readonly number[]): boolean {
  if (actual.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return expectedSet.size === expected.length && actual.every((id) => expectedSet.has(id));
}

function versionsMatch(
  items: ReadonlyArray<{ readonly id: number; readonly updatedAt: Date }>,
  mutation: FulfillmentOrderMutation,
): boolean {
  const expected = new Map(mutation.expectedItems.map((item) => [item.id, item.updatedAt]));
  return items.every((item) => expected.get(item.id) === item.updatedAt.toISOString());
}

function notificationBody(input: {
  readonly date: string;
  readonly startTime: string;
  readonly location: string;
  readonly menuNames: readonly string[];
  readonly reasonLabel: string;
}): string {
  return [
    `${input.date} ${input.startTime} · ${input.location}`,
    Array.from(new Set(input.menuNames)).join(", "),
    `사유: ${input.reasonLabel}`,
  ].join("\n");
}

export async function applyFulfillmentOrderAction(input: {
  readonly meetingId: number;
  readonly body: unknown;
  readonly actorKakaoId: string | null;
}): Promise<FulfillmentOrderActionResult> {
  const parsed = parseFulfillmentOrderAction(input.body);
  if (!parsed.ok || !Number.isInteger(input.meetingId)) return { kind: "invalid" };

  try {
    return await runSerializableTransaction(async (transaction) => {
      const requested = await transaction.participantFoodOrderItem.findMany({
        where: { meetingId: input.meetingId, id: { in: [...parsed.value.orderItemIds] } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          meetingId: true,
          participantId: true,
          foodOrderId: true,
          menuItemId: true,
          menuOptionChoiceId: true,
          menuNameSnapshot: true,
          optionChoiceLabelSnapshot: true,
          quantity: true,
          preparingQuantity: true,
          servedQuantity: true,
          cancelledAt: true,
          updatedAt: true,
          participant: {
            select: {
              name: true,
              kakaoId: true,
              companionId: true,
              companion: { select: { linkedKakaoId: true } },
            },
          },
          meeting: { select: { date: true, startTime: true, location: true } },
        },
      });
      if (requested.length !== parsed.value.orderItemIds.length) return { kind: "not_found" };
      const first = requested[0];
      if (!first) return { kind: "not_found" };
      const key = fulfillmentVariantKey(first);
      if (requested.some((item) => (
        item.foodOrderId !== first.foodOrderId
        || item.participantId !== first.participantId
        || fulfillmentVariantKey(item) !== key
      ))) {
        return { kind: "not_found" };
      }

      const siblings = await transaction.participantFoodOrderItem.findMany({
        where: { meetingId: input.meetingId, foodOrderId: first.foodOrderId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          meetingId: true,
          participantId: true,
          foodOrderId: true,
          menuItemId: true,
          menuOptionChoiceId: true,
          menuNameSnapshot: true,
          optionChoiceLabelSnapshot: true,
          quantity: true,
          preparingQuantity: true,
          servedQuantity: true,
          cancelledAt: true,
          updatedAt: true,
        },
      });
      const row = siblings.filter((item) => fulfillmentVariantKey(item) === key);
      if (!sameIds(row.map((item) => item.id), parsed.value.orderItemIds)) return { kind: "invalid" };
      if (!versionsMatch(row, parsed.value)) return { kind: "conflict" };
      const updates = getFulfillmentItemUpdates(parsed.value.action, row);
      if (!updates) return { kind: "conflict" };

      const cancelledAt = new Date();
      const updateById = new Map(updates.map((update) => [update.id, update]));
      for (const item of row) {
        const update = updateById.get(item.id);
        if (!update) throw new FulfillmentWriteConflictError();
        const written = await transaction.participantFoodOrderItem.updateMany({
          where: {
            id: item.id,
            meetingId: item.meetingId,
            participantId: item.participantId,
            foodOrderId: item.foodOrderId,
            quantity: item.quantity,
            preparingQuantity: item.preparingQuantity,
            servedQuantity: item.servedQuantity,
            cancelledAt: null,
            updatedAt: item.updatedAt,
          },
          data: update.cancel
            ? {
                preparingQuantity: 0,
                cancelledAt,
                cancelledReasonCode: parsed.value.reasonCode,
                cancelledReasonText: parsed.value.reasonText,
                cancelledByKakaoId: input.actorKakaoId,
              }
            : {
                preparingQuantity: update.preparingQuantity,
                servedQuantity: update.servedQuantity,
              },
        });
        if (written.count !== 1) throw new FulfillmentWriteConflictError();
      }

      if (parsed.value.action === "cancel" && parsed.value.reasonCode) {
        const recipientKakaoId = first.participant.companionId && first.participant.companion?.linkedKakaoId
          ? first.participant.companion.linkedKakaoId
          : first.participant.kakaoId;
        const reasonLabel = parsed.value.reasonText || ORDER_CANCEL_REASON_LABELS[parsed.value.reasonCode];
        await transaction.userNotification.create({
          data: {
            recipientKakaoId,
            type: "ORDER_CANCELLED",
            meetingId: input.meetingId,
            participantId: first.participantId,
            foodOrderItemId: first.id,
            title: `${first.participant.name} 주문이 취소되었습니다`,
            body: notificationBody({
              date: first.meeting.date,
              startTime: first.meeting.startTime,
              location: first.meeting.location,
              menuNames: requested.map((item) => item.optionChoiceLabelSnapshot
                ? `${item.menuNameSnapshot} · ${item.optionChoiceLabelSnapshot}`
                : item.menuNameSnapshot),
              reasonLabel,
            }),
          },
        });
      }
      return { kind: "success" };
    });
  } catch (error) {
    if (
      error instanceof FulfillmentWriteConflictError
      || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
    ) {
      return { kind: "conflict" };
    }
    throw error;
  }
}
