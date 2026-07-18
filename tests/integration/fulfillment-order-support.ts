import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { PATCH } from "../../src/app/api/shop/meetings/[id]/orders/route";
import type { FulfillmentOrderAction } from "../../src/lib/fulfillment-order-action";
import type { AdminMeetingFoodOrdersData, FulfillmentOrderRow } from "../../src/lib/fulfillment-order-types";
import { encodeSession } from "../../src/lib/session";

function request(body: unknown, kakaoId: string | null): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (kakaoId) {
    headers.set("cookie", `__session=${encodeSession({ kakaoId, nickname: `합성 ${kakaoId}` })}`);
  }
  return new NextRequest("http://127.0.0.1:3100/api/shop/meetings/8101/orders", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

export async function invokeShopAction(
  meetingId: number,
  body: unknown,
  kakaoId: string | null = "qa-user-04",
): Promise<Response> {
  return PATCH(request(body, kakaoId), { params: Promise.resolve({ id: String(meetingId) }) });
}

export function actionPayload(
  row: FulfillmentOrderRow,
  action: FulfillmentOrderAction,
  reason?: { readonly reasonCode: string; readonly reasonText?: string },
) {
  return {
    action,
    orderItemIds: [...row.orderItemIds],
    expectedItems: [...row.expectedItems],
    ...reason,
  };
}

export function rowForOrder(
  data: AdminMeetingFoodOrdersData | null,
  orderId: number,
  menuItemId?: number,
): FulfillmentOrderRow {
  const row = data?.orderRows.find((candidate) => (
    candidate.orderId === orderId && (menuItemId === undefined || candidate.menuItemId === menuItemId)
  ));
  assert.ok(row, `missing fulfillment row for order ${orderId}`);
  return row;
}

export async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}

export async function assertActionError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  const body = await jsonRecord(response);
  assert.equal(body.code, code);
  return body;
}
