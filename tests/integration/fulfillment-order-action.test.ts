import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { db } from "../../scripts/qa/local-db";
import { prisma } from "../../src/lib/db";
import { getAdminMeetingFoodOrdersData } from "../../src/lib/fulfillment-order-data";
import { invokeRevision } from "./participant-order-support";
import { createActiveOrder } from "./participant-order-support";
import {
  actionPayload,
  assertActionError,
  invokeShopAction,
  jsonRecord,
  rowForOrder,
} from "./fulfillment-order-support";

async function createDuplicateVariantOrder(client: PrismaClient) {
  const menu = await client.foodMenuItem.findUniqueOrThrow({
    where: { id: 8413 },
    select: { id: true, name: true, price: true },
  });
  return client.participantFoodOrder.create({
    data: {
      meetingId: 8101,
      participantId: 8801,
      items: {
        create: [1, 2].map(() => ({
          meetingId: 8101,
          participantId: 8801,
          menuItemId: menu.id,
          menuNameSnapshot: menu.name,
          unitPriceSnapshot: menu.price,
          quantity: 1,
        })),
      },
    },
    include: { items: true },
  });
}

async function currentRow(orderId: number, menuItemId?: number) {
  return rowForOrder(await getAdminMeetingFoodOrdersData(8101), orderId, menuItemId);
}

test("fulfillment transition table, payload ordering, versioned prepare serve, and repeated submission identity", async () => {
  const ownerToken = process.env.SURFING_QA_OWNER_TOKEN ?? "";
  const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
  const client = new PrismaClient();
  try {
    await db.start(ownerToken);
    await db.reset(ownerToken, evidenceDirectory);

    const initial = await getAdminMeetingFoodOrdersData(8101);
    assert.ok(initial);
    assert.deepEqual(initial.orderRows.map((row) => row.orderId), [8901, 8901, 8902, 8903, 8903, 8904, 8905]);
    assert.equal(initial.menuRows.every((row) => row.orderedQuantity > 0 || row.cancelledQuantity > 0), true);
    assert.equal(initial.orderRows.every((row) => row.expectedItems.length === row.orderItemIds.length), true);

    const repeated = await createActiveOrder(client, 8101, 8801);
    const repeatedRows = (await getAdminMeetingFoodOrdersData(8101))?.orderRows.filter((row) => (
      row.participantId === 8801 && row.menuItemId === 8413
    ));
    assert.deepEqual(repeatedRows?.map((row) => row.orderId), [8901, repeated.id]);
    assert.equal(new Set(repeatedRows?.map((row) => row.rowId)).size, 2);

    const baseRow = rowForOrder(initial, 8901, 8413);
    await assertActionError(await invokeShopAction(8101, actionPayload(baseRow, "prepare"), null), 401, "AUTH_REQUIRED");
    await assertActionError(await invokeShopAction(8101, actionPayload(baseRow, "prepare"), "qa-user-01"), 401, "AUTH_REQUIRED");
    await assertActionError(await invokeShopAction(8101, { ...actionPayload(baseRow, "prepare"), extra: true }), 400, "INVALID_ORDER_ACTION");
    await assertActionError(await invokeShopAction(8101, {
      ...actionPayload(baseRow, "prepare"),
      expectedItems: [],
    }), 400, "INVALID_ORDER_ACTION");
    await assertActionError(await invokeShopAction(8101, {
      action: "prepare",
      orderItemIds: [9001, 9002],
      expectedItems: [
        rowForOrder(initial, 8901, 8401).expectedItems[0],
        baseRow.expectedItems[0],
      ],
    }), 404, "ORDER_ACTION_NOT_FOUND");
    await assertActionError(await invokeShopAction(8101, {
      action: "prepare",
      orderItemIds: [99_999],
      expectedItems: [{ id: 99_999, updatedAt: "2026-01-01T00:00:00.000Z" }],
    }), 404, "ORDER_ACTION_NOT_FOUND");
    await assertActionError(await invokeShopAction(8101, {
      ...actionPayload(baseRow, "cancel"),
      reasonCode: "other",
      reasonText: "   ",
    }), 400, "INVALID_ORDER_ACTION");

    const duplicate = await createDuplicateVariantOrder(client);
    const duplicateRow = await currentRow(duplicate.id);
    await assertActionError(await invokeShopAction(8101, {
      action: "prepare",
      orderItemIds: [duplicateRow.orderItemIds[0]],
      expectedItems: [duplicateRow.expectedItems[0]],
    }), 400, "INVALID_ORDER_ACTION");
    assert.equal((await client.participantFoodOrderItem.findMany({ where: { foodOrderId: duplicate.id } }))
      .every((item) => item.preparingQuantity === 0), true);

    const transition = await createActiveOrder(client, 8101, 8801);
    const active = await currentRow(transition.id);
    const prepared = await invokeShopAction(8101, actionPayload(active, "prepare"));
    assert.equal(prepared.status, 200);
    assert.ok("data" in await jsonRecord(prepared));
    assert.equal((await client.participantFoodOrderItem.findFirstOrThrow({ where: { foodOrderId: transition.id } })).preparingQuantity, 1);

    const stale = await invokeShopAction(8101, actionPayload(active, "serve"));
    const staleBody = await assertActionError(stale, 409, "ORDER_ACTION_CONFLICT");
    assert.deepEqual(staleBody.current, await getAdminMeetingFoodOrdersData(8101));

    const served = await invokeShopAction(8101, actionPayload(await currentRow(transition.id), "serve"));
    assert.equal(served.status, 200);
    await assertActionError(
      await invokeShopAction(8101, actionPayload(await currentRow(transition.id), "serve")),
      409,
      "ORDER_ACTION_CONFLICT",
    );
    assert.equal((await client.participantFoodOrderItem.findFirstOrThrow({ where: { foodOrderId: transition.id } })).servedQuantity, 1);
    assert.equal((await invokeShopAction(8101, actionPayload(await currentRow(transition.id), "undo_serve"))).status, 200);
    assert.equal((await invokeShopAction(8101, actionPayload(await currentRow(transition.id), "prepare"))).status, 200);
    assert.equal((await invokeShopAction(8101, actionPayload(await currentRow(transition.id), "undo_prepare"))).status, 200);

    const cancelled = await createActiveOrder(client, 8101, 8801);
    const cancelResponse = await invokeShopAction(8101, actionPayload(
      await currentRow(cancelled.id),
      "cancel",
      { reasonCode: "sold_out" },
    ));
    assert.equal(cancelResponse.status, 200);
    const cancelledItem = await client.participantFoodOrderItem.findFirstOrThrow({ where: { foodOrderId: cancelled.id } });
    assert.equal(cancelledItem.cancelledReasonCode, "sold_out");
    assert.equal(cancelledItem.cancelledByKakaoId, "qa-user-04");
    assert.equal(await client.userNotification.count({ where: { foodOrderItemId: cancelledItem.id } }), 1);

    const actionRace = await createActiveOrder(client, 8101, 8801);
    const actionRacePayload = await currentRow(actionRace.id);
    const actionResponses = await Promise.all([
      invokeShopAction(8101, actionPayload(actionRacePayload, "serve")),
      invokeShopAction(8101, actionPayload(actionRacePayload, "cancel", { reasonCode: "duplicate" })),
    ]);
    assert.deepEqual(actionResponses.map((response) => response.status).sort(), [200, 409]);
    const actionConflict = actionResponses.find((response) => response.status === 409);
    assert.ok(actionConflict);
    assert.deepEqual((await jsonRecord(actionConflict)).current, await getAdminMeetingFoodOrdersData(8101));

    const participantReplaceRace = await createActiveOrder(client, 8101, 8801);
    const replaceRow = await currentRow(participantReplaceRace.id);
    const replaceResponses = await Promise.all([
      invokeRevision("PATCH", 8101, participantReplaceRace.id, {
        replacementItems: [{ menuItemId: 8413, optionChoiceId: null, quantity: 2 }],
        expectedItems: replaceRow.expectedItems,
      }, "qa-user-01"),
      invokeShopAction(8101, actionPayload(replaceRow, "prepare")),
    ]);
    assert.deepEqual(replaceResponses.map((response) => response.status).sort(), [200, 409]);

    const participantCancelRace = await createActiveOrder(client, 8101, 8801);
    const deleteRow = await currentRow(participantCancelRace.id);
    const deleteResponses = await Promise.all([
      invokeRevision("DELETE", 8101, participantCancelRace.id, { expectedItems: deleteRow.expectedItems }, "qa-user-01"),
      invokeShopAction(8101, actionPayload(deleteRow, "serve")),
    ]);
    assert.deepEqual(deleteResponses.map((response) => response.status).sort(), [200, 409]);

    const independentA = await createActiveOrder(client, 8101, 8801);
    const independentB = await createActiveOrder(client, 8101, 8802);
    const independentResponses = await Promise.all([
      invokeShopAction(8101, actionPayload(await currentRow(independentA.id), "prepare")),
      invokeShopAction(8101, actionPayload(await currentRow(independentB.id), "serve")),
    ]);
    assert.deepEqual(independentResponses.map((response) => response.status), [200, 200]);
  } finally {
    await Promise.all([client.$disconnect(), prisma.$disconnect()]);
    await db.down(ownerToken);
  }
});
