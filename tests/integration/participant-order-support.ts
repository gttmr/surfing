import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "../../src/app/api/meetings/[id]/orders/[orderId]/route";
import { GET, POST } from "../../src/app/api/meetings/[id]/orders/route";
import { encodeSession } from "../../src/lib/session";

export type RevisionMethod = "PATCH" | "DELETE";

function cookie(kakaoId: string): string {
  return `__session=${encodeSession({ kakaoId, nickname: `합성 ${kakaoId}` })}`;
}

function request(
  url: string,
  method: string,
  body: unknown,
  kakaoId: string | null,
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (kakaoId) headers.set("cookie", cookie(kakaoId));
  return new NextRequest(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function invokeRevision(
  method: RevisionMethod,
  meetingId: number,
  orderId: number,
  body: unknown,
  kakaoId: string | null,
): Promise<Response> {
  const url = `http://127.0.0.1:3100/api/meetings/${meetingId}/orders/${orderId}`;
  const context = {
    params: Promise.resolve({ id: String(meetingId), orderId: String(orderId) }),
  };
  const nextRequest = request(url, method, body, kakaoId);
  return method === "PATCH" ? PATCH(nextRequest, context) : DELETE(nextRequest, context);
}

export async function invokeOrderCollection(
  method: "GET" | "POST",
  meetingId: number,
  body: unknown,
  kakaoId: string | null,
): Promise<Response> {
  const url = `http://127.0.0.1:3100/api/meetings/${meetingId}/orders`;
  const context = { params: Promise.resolve({ id: String(meetingId) }) };
  const nextRequest = request(url, method, body, kakaoId);
  return method === "GET" ? GET(nextRequest, context) : POST(nextRequest, context);
}

export async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}

export async function expectedItems(client: PrismaClient, orderId: number) {
  const rows = await client.participantFoodOrderItem.findMany({
    where: { foodOrderId: orderId },
    orderBy: { id: "asc" },
    select: { id: true, updatedAt: true },
  });
  return rows.map((item) => ({ id: item.id, updatedAt: item.updatedAt.toISOString() }));
}

export async function createActiveOrder(
  client: PrismaClient,
  meetingId: number,
  participantId: number,
  preparingQuantity = 0,
) {
  const menu = await client.foodMenuItem.findUniqueOrThrow({
    where: { id: 8413 },
    select: { id: true, name: true, price: true },
  });
  return client.participantFoodOrder.create({
    data: {
      meetingId,
      participantId,
      items: {
        create: {
          meetingId,
          participantId,
          menuItemId: menu.id,
          menuNameSnapshot: menu.name,
          unitPriceSnapshot: menu.price,
          quantity: 1,
          preparingQuantity,
        },
      },
    },
    include: { items: true },
  });
}

export async function assertError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  const body = await jsonRecord(response);
  assert.equal(body.code, code);
  return body;
}
