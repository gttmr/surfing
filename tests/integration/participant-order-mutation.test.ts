import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { db } from "../../scripts/qa/local-db";
import { getTodayInSeoul } from "../../src/lib/date";
import { prisma } from "../../src/lib/db";
import { getParticipantMeetingFoodOrdersData } from "../../src/lib/food-ordering-data";
import {
  assertError,
  createActiveOrder,
  expectedItems,
  invokeOrderCollection,
  invokeRevision,
  jsonRecord,
} from "./participant-order-support";

const replaceBody = (expected: Awaited<ReturnType<typeof expectedItems>>) => ({
  replacementItems: [
    { menuItemId: 8413, optionChoiceId: null, quantity: 2 },
    { menuItemId: 8402, optionChoiceId: 8504, quantity: 1 },
  ],
  expectedItems: expected,
});

test("participant order validation precedence, replace, cancel, P1 P2 P3 ownership, and history snapshots", async () => {
  const ownerToken = process.env.SURFING_QA_OWNER_TOKEN ?? "";
  const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
  const client = new PrismaClient();
  try {
    await db.start(ownerToken);
    await db.reset(ownerToken, evidenceDirectory);

    await assertError(await invokeRevision("PATCH", 8101, 8901, {}, null), 401, "AUTH_REQUIRED");
    await assertError(await invokeRevision("PATCH", 8101, 999_999, {}, "qa-user-01"), 404, "ORDER_NOT_FOUND");
    await assertError(await invokeRevision("PATCH", 8101, 8901, {}, "qa-user-02"), 403, "ORDER_FORBIDDEN");
    await assertError(
      await invokeRevision("PATCH", 8101, 8901, { replacementItems: [], expectedItems: [], extra: true }, "qa-user-01"),
      400,
      "INVALID_ORDER_MUTATION",
    );

    const closedOrder = await createActiveOrder(client, 8103, 8838, 1);
    await assertError(
      await invokeRevision("DELETE", 8103, closedOrder.id, { expectedItems: [] }, "qa-user-01"),
      409,
      "ORDER_NOT_OPEN",
    );
    await assertError(
      await invokeRevision("DELETE", 8101, 8902, { expectedItems: [] }, "qa-user-01"),
      409,
      "ORDER_NOT_EDITABLE",
    );
    const staleBody = await assertError(
      await invokeRevision("DELETE", 8101, 8901, { expectedItems: [] }, "qa-user-01"),
      409,
      "ORDER_VERSION_CONFLICT",
    );
    assert.deepEqual(staleBody.current, await getParticipantMeetingFoodOrdersData(8101, "qa-user-01"));

    const beforeInvalid = await client.participantFoodOrderItem.findMany({
      where: { foodOrderId: 8901 },
      orderBy: { id: "asc" },
    });
    for (const replacementItems of [
      [{ menuItemId: 99_999, optionChoiceId: null, quantity: 1 }],
      [{ menuItemId: 8437, optionChoiceId: null, quantity: 1 }],
      [{ menuItemId: 8413, optionChoiceId: 8504, quantity: 1 }],
    ]) {
      await assertError(
        await invokeRevision("PATCH", 8101, 8901, {
          replacementItems,
          expectedItems: await expectedItems(client, 8901),
        }, "qa-user-01"),
        400,
        "INVALID_ORDER_MUTATION",
      );
    }
    assert.deepEqual(
      await client.participantFoodOrderItem.findMany({ where: { foodOrderId: 8901 }, orderBy: { id: "asc" } }),
      beforeInvalid,
    );

    const bannedOrder = await createActiveOrder(client, 8101, 8808);
    assert.equal((await invokeOrderCollection("GET", 8101, undefined, "qa-user-08")).status, 200);
    await assertError(
      await invokeRevision("DELETE", 8101, bannedOrder.id, { expectedItems: await expectedItems(client, bannedOrder.id) }, "qa-user-08"),
      403,
      "ORDER_FORBIDDEN",
    );
    await assertError(
      await invokeOrderCollection("POST", 8101, { participantId: 8808, items: [] }, "qa-user-08"),
      403,
      "ORDER_FORBIDDEN",
    );

    const originalItems = await client.participantFoodOrderItem.findMany({
      where: { foodOrderId: 8901 },
      orderBy: { id: "asc" },
    });
    const replaceResponse = await invokeRevision(
      "PATCH",
      8101,
      8901,
      replaceBody(await expectedItems(client, 8901)),
      "qa-user-01",
    );
    assert.equal(replaceResponse.status, 200);
    const replaceJson = await jsonRecord(replaceResponse);
    assert.equal(typeof replaceJson.replacementOrderId, "number");
    if (typeof replaceJson.replacementOrderId !== "number") throw new Error("missing replacement order id");
    const replacementOrderId = replaceJson.replacementOrderId;
    assert.notEqual(replacementOrderId, 8901);
    const replaceData = await getParticipantMeetingFoodOrdersData(8101, "qa-user-01");
    assert.deepEqual(replaceJson.data, replaceData);
    const ownHistory = replaceData?.participants.find((participant) => participant.participantId === 8801)?.orders;
    assert.deepEqual(ownHistory?.map((order) => order.orderId), [8901, 8902, replacementOrderId]);
    const historicalItem = ownHistory?.[0]?.items[0];
    assert.equal(historicalItem?.id, originalItems[0]?.id);
    assert.equal(historicalItem?.createdAt, originalItems[0]?.createdAt.toISOString());
    assert.equal(historicalItem?.cancelledByKakaoId, "qa-user-01");
    assert.equal(typeof historicalItem?.updatedAt, "string");
    assert.equal(historicalItem?.preparingQuantity, 0);
    assert.equal(historicalItem?.servedQuantity, 0);

    const cancelledOriginal = await client.participantFoodOrderItem.findMany({
      where: { foodOrderId: 8901 },
      orderBy: { id: "asc" },
    });
    for (const [index, item] of cancelledOriginal.entries()) {
      const before = originalItems[index];
      assert.ok(before);
      assert.equal(item.quantity, before.quantity);
      assert.equal(item.menuNameSnapshot, before.menuNameSnapshot);
      assert.equal(item.optionChoiceLabelSnapshot, before.optionChoiceLabelSnapshot);
      assert.equal(item.unitPriceSnapshot, before.unitPriceSnapshot);
      assert.equal(item.createdAt.toISOString(), before.createdAt.toISOString());
      assert.ok(item.updatedAt > before.updatedAt);
      assert.equal(item.cancelledReasonCode, "participant_edit");
      assert.equal(item.cancelledReasonText, "참가자 주문 수정");
      assert.equal(item.cancelledByKakaoId, "qa-user-01");
    }
    const replacement = await client.participantFoodOrder.findUniqueOrThrow({
      where: { id: replacementOrderId },
      include: { items: true },
    });
    assert.equal(replacement.items.length, 2);
    assert.equal(replacement.items.every((item) => item.cancelledAt === null), true);

    const cancelResponse = await invokeRevision(
      "DELETE",
      8101,
      replacementOrderId,
      { expectedItems: await expectedItems(client, replacementOrderId) },
      "qa-user-01",
    );
    assert.equal(cancelResponse.status, 200);
    const cancelJson = await jsonRecord(cancelResponse);
    assert.deepEqual(cancelJson.data, await getParticipantMeetingFoodOrdersData(8101, "qa-user-01"));
    assert.equal(await client.participantFoodOrder.count({ where: { id: replacementOrderId } }), 1);
    const cancelledReplacement = await client.participantFoodOrderItem.findMany({ where: { foodOrderId: replacementOrderId } });
    assert.equal(cancelledReplacement.every((item) => item.cancelledReasonCode === "participant_cancel"), true);

    await client.meeting.update({ where: { id: 8102 }, data: { date: getTodayInSeoul() } });
    const linkedOrder = await createActiveOrder(client, 8102, 8836);
    const proxyOrder = await createActiveOrder(client, 8102, 8837);
    assert.equal((await invokeRevision("DELETE", 8102, linkedOrder.id, { expectedItems: await expectedItems(client, linkedOrder.id) }, "qa-user-02")).status, 200);
    assert.equal((await invokeRevision("DELETE", 8102, proxyOrder.id, { expectedItems: await expectedItems(client, proxyOrder.id) }, "qa-user-03")).status, 200);

    const raceOrder = await createActiveOrder(client, 8101, 8801);
    const raceExpected = await expectedItems(client, raceOrder.id);
    const beforeRaceCount = await client.participantFoodOrder.count({ where: { participantId: 8801 } });
    const raceResponses = await Promise.all([
      invokeRevision("PATCH", 8101, raceOrder.id, replaceBody(raceExpected), "qa-user-01"),
      invokeRevision("PATCH", 8101, raceOrder.id, replaceBody(raceExpected), "qa-user-01"),
    ]);
    assert.deepEqual(raceResponses.map((response) => response.status).sort(), [200, 409]);
    const conflictResponse = raceResponses.find((response) => response.status === 409);
    assert.ok(conflictResponse);
    const conflictJson = await jsonRecord(conflictResponse);
    assert.ok(conflictJson.code === "ORDER_NOT_EDITABLE" || conflictJson.code === "ORDER_VERSION_CONFLICT");
    assert.deepEqual(conflictJson.current, await getParticipantMeetingFoodOrdersData(8101, "qa-user-01"));
    assert.equal(await client.participantFoodOrder.count({ where: { participantId: 8801 } }), beforeRaceCount + 1);
  } finally {
    await Promise.all([client.$disconnect(), prisma.$disconnect()]);
    await db.down(ownerToken);
  }
});
