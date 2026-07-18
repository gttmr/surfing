import { getFoodOrderParticipantAccess, isMeetingOrderOpen } from "@/lib/food-ordering";
import {
  getParticipantOrderConflict,
  parseParticipantOrderMutation,
  resolveParticipantOrderReplacements,
  type ParticipantOrderCatalogMenu,
  type ParticipantOrderConflictCode,
} from "@/lib/participant-order-mutation";
import { runSerializableTransaction } from "@/lib/transaction";

export type ParticipantOrderRevisionResult =
  | { readonly kind: "success"; readonly replacementOrderId: number | null }
  | { readonly kind: "not_found" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "invalid" }
  | { readonly kind: "conflict"; readonly code: ParticipantOrderConflictCode };

class ParticipantOrderWriteConflictError extends Error {
  readonly name = "ParticipantOrderWriteConflictError";
}

function participantCanMutate(
  sessionKakaoId: string,
  actorRole: string,
  participant: {
    readonly kakaoId: string;
    readonly companionId: number | null;
    readonly companion: {
      readonly ownerKakaoId: string;
      readonly linkedKakaoId: string | null;
    } | null;
  },
): boolean {
  if (actorRole === "BANNED") return false;
  return getFoodOrderParticipantAccess({
    sessionKakaoId,
    participantKakaoId: participant.kakaoId,
    companionId: participant.companionId,
    companionOwnerKakaoId: participant.companion?.ownerKakaoId ?? null,
    companionLinkedKakaoId: participant.companion?.linkedKakaoId ?? null,
  }).canOrder;
}

function mapCatalogMenus(
  rows: ReadonlyArray<{
    readonly id: number;
    readonly name: string;
    readonly price: number;
    readonly optionGroupName: string | null;
    readonly isActive: boolean;
    readonly optionChoices: ReadonlyArray<{
      readonly id: number;
      readonly label: string;
      readonly price: number | null;
    }>;
  }>,
): ParticipantOrderCatalogMenu[] {
  return rows.map((menu) => ({
    id: menu.id,
    name: menu.name,
    price: menu.price,
    optionGroupName: menu.optionGroupName,
    isActive: menu.isActive,
    options: menu.optionChoices.map((option) => ({
      id: option.id,
      label: option.label,
      price: option.price ?? menu.price,
    })),
  }));
}

export async function reviseParticipantOrder(input: {
  readonly meetingId: number;
  readonly orderId: number;
  readonly sessionKakaoId: string;
  readonly method: "PATCH" | "DELETE";
  readonly body: unknown;
}): Promise<ParticipantOrderRevisionResult> {
  try {
    return await runSerializableTransaction(async (transaction) => {
      const [actor, order] = await Promise.all([
        transaction.user.findUnique({
          where: { kakaoId: input.sessionKakaoId },
          select: { role: true },
        }),
        transaction.participantFoodOrder.findFirst({
          where: { id: input.orderId, meetingId: input.meetingId },
          select: {
            id: true,
            meetingId: true,
            participantId: true,
            meeting: { select: { date: true } },
            participant: {
              select: {
                kakaoId: true,
                companionId: true,
                companion: { select: { ownerKakaoId: true, linkedKakaoId: true } },
              },
            },
            items: {
              orderBy: { id: "asc" },
              select: {
                id: true,
                updatedAt: true,
                cancelledAt: true,
                preparingQuantity: true,
                servedQuantity: true,
              },
            },
          },
        }),
      ]);

      if (!order) return { kind: "not_found" };
      if (!actor || !participantCanMutate(input.sessionKakaoId, actor.role, order.participant)) {
        return { kind: "forbidden" };
      }

      const parsed = parseParticipantOrderMutation(input.method, input.body);
      if (!parsed.ok) return { kind: "invalid" };

      let replacements = null;
      if (parsed.value.kind === "replace") {
        const menuIds = parsed.value.replacementItems.map((item) => item.menuItemId);
        const menuRows = await transaction.foodMenuItem.findMany({
          where: { id: { in: menuIds } },
          select: {
            id: true,
            name: true,
            price: true,
            optionGroupName: true,
            isActive: true,
            optionChoices: { select: { id: true, label: true, price: true } },
          },
        });
        replacements = resolveParticipantOrderReplacements(
          parsed.value.replacementItems,
          mapCatalogMenus(menuRows),
        );
        if (!replacements) return { kind: "invalid" };
      }

      const conflict = getParticipantOrderConflict(
        order.items,
        parsed.value.expectedItems,
        isMeetingOrderOpen(order.meeting.date),
      );
      if (conflict) return { kind: "conflict", code: conflict };

      const cancelledAt = new Date();
      const reasonCode = parsed.value.kind === "replace" ? "participant_edit" : "participant_cancel";
      const reasonText = parsed.value.kind === "replace" ? "참가자 주문 수정" : "참가자 주문 취소";
      for (const item of order.items) {
        const updated = await transaction.participantFoodOrderItem.updateMany({
          where: {
            id: item.id,
            foodOrderId: order.id,
            meetingId: order.meetingId,
            participantId: order.participantId,
            updatedAt: item.updatedAt,
            cancelledAt: null,
            preparingQuantity: 0,
            servedQuantity: 0,
          },
          data: {
            cancelledAt,
            cancelledReasonCode: reasonCode,
            cancelledReasonText: reasonText,
            cancelledByKakaoId: input.sessionKakaoId,
          },
        });
        if (updated.count !== 1) throw new ParticipantOrderWriteConflictError();
      }

      if (!replacements) return { kind: "success", replacementOrderId: null };
      const replacement = await transaction.participantFoodOrder.create({
        data: {
          meetingId: order.meetingId,
          participantId: order.participantId,
          items: {
            create: replacements.map((item) => ({
              meetingId: order.meetingId,
              participantId: order.participantId,
              ...item,
            })),
          },
        },
        select: { id: true },
      });
      return { kind: "success", replacementOrderId: replacement.id };
    });
  } catch (error) {
    if (error instanceof ParticipantOrderWriteConflictError) {
      return { kind: "conflict", code: "ORDER_VERSION_CONFLICT" };
    }
    throw error;
  }
}
