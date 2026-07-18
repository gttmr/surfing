import { NextResponse, type NextRequest } from "next/server";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { getParticipantMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import {
  reviseParticipantOrder,
  type ParticipantOrderRevisionResult,
} from "@/lib/participant-order-revision";

const ERROR_DETAILS = {
  ORDER_NOT_OPEN: "오늘 모임의 주문만 변경할 수 있습니다.",
  ORDER_NOT_EDITABLE: "이미 처리되었거나 취소된 주문은 변경할 수 없습니다.",
  ORDER_VERSION_CONFLICT: "주문 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
} as const;

function notFoundResponse() {
  return NextResponse.json(
    { error: "주문을 찾을 수 없습니다.", code: "ORDER_NOT_FOUND" },
    { status: 404 },
  );
}

function parseRouteId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function mutationResponse(
  result: ParticipantOrderRevisionResult,
  meetingId: number,
  kakaoId: string,
) {
  if (result.kind === "not_found") return notFoundResponse();
  if (result.kind === "forbidden") {
    return NextResponse.json(
      { error: "이 주문을 변경할 수 없습니다.", code: "ORDER_FORBIDDEN" },
      { status: 403 },
    );
  }
  if (result.kind === "invalid") {
    return NextResponse.json(
      { error: "주문 변경 요청이 올바르지 않습니다.", code: "INVALID_ORDER_MUTATION" },
      { status: 400 },
    );
  }

  const data = await getParticipantMeetingFoodOrdersData(meetingId, kakaoId);
  if (!data) return notFoundResponse();
  if (result.kind === "conflict") {
    return NextResponse.json(
      { error: ERROR_DETAILS[result.code], code: result.code, current: data },
      { status: 409 },
    );
  }
  return NextResponse.json(
    result.replacementOrderId === null
      ? { data }
      : { data, replacementOrderId: result.replacementOrderId },
  );
}

async function mutate(
  method: "PATCH" | "DELETE",
  request: NextRequest,
  context: { readonly params: Promise<{ readonly id: string; readonly orderId: string }> },
) {
  const session = await getActiveSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  const params = await context.params;
  const meetingId = parseRouteId(params.id);
  const orderId = parseRouteId(params.orderId);
  if (meetingId === null || orderId === null) return notFoundResponse();
  const body: unknown = await request.json().then((value: unknown) => value, () => null);
  const result = await reviseParticipantOrder({
    meetingId,
    orderId,
    sessionKakaoId: session.kakaoId,
    method,
    body,
  });
  return mutationResponse(result, meetingId, session.kakaoId);
}

export async function PATCH(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly id: string; readonly orderId: string }> },
) {
  return mutate("PATCH", request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly id: string; readonly orderId: string }> },
) {
  return mutate("DELETE", request, context);
}
