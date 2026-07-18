import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { getAdminMeetingFoodOrdersData } from "@/lib/fulfillment-order-data";
import { applyFulfillmentOrderAction } from "@/lib/fulfillment-order-service";

const AUTH_ERROR = { error: "Unauthorized", code: "AUTH_REQUIRED" } as const;
const NOT_FOUND_ERROR = { error: "주문 항목을 찾을 수 없습니다.", code: "ORDER_ACTION_NOT_FOUND" } as const;
const INVALID_ERROR = { error: "주문 처리 요청이 올바르지 않습니다.", code: "INVALID_ORDER_ACTION" } as const;
const CONFLICT_ERROR = { error: "주문 상태가 변경되었습니다. 현재 상태를 확인해 주세요.", code: "ORDER_ACTION_CONFLICT" } as const;

async function requestBody(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}

export async function handleFulfillmentOrderPatch(input: {
  readonly request: NextRequest;
  readonly meetingId: number;
  readonly authorized: boolean;
}): Promise<NextResponse> {
  if (!input.authorized) return NextResponse.json(AUTH_ERROR, { status: 401 });
  if (!Number.isInteger(input.meetingId)) return NextResponse.json(NOT_FOUND_ERROR, { status: 404 });

  const session = await getActiveSessionFromRequest(input.request);
  const result = await applyFulfillmentOrderAction({
    meetingId: input.meetingId,
    body: await requestBody(input.request),
    actorKakaoId: session?.kakaoId ?? null,
  });
  if (result.kind === "invalid") return NextResponse.json(INVALID_ERROR, { status: 400 });
  if (result.kind === "not_found") return NextResponse.json(NOT_FOUND_ERROR, { status: 404 });

  const data = await getAdminMeetingFoodOrdersData(input.meetingId);
  if (!data) return NextResponse.json(NOT_FOUND_ERROR, { status: 404 });
  if (result.kind === "conflict") {
    return NextResponse.json({ ...CONFLICT_ERROR, current: data }, { status: 409 });
  }
  return NextResponse.json({ data });
}
