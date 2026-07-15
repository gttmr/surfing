import type { ParticipantMeetingFoodOrdersData } from "@/lib/food-ordering-data";

type OrderClientSuccess = {
  readonly ok: true;
  readonly data: ParticipantMeetingFoodOrdersData;
  readonly replacementOrderId?: number;
};

export type OrderClientResult = OrderClientSuccess | {
  readonly ok: false;
  readonly status: number;
  readonly code: string | null;
  readonly message: string;
  readonly current: ParticipantMeetingFoodOrdersData | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function participantOrderData(value: unknown): ParticipantMeetingFoodOrdersData | null {
  if (!isRecord(value) || !isRecord(value.meeting)) return null;
  if (!Array.isArray(value.menus) || !Array.isArray(value.participants)) return null;
  if (typeof value.supportCap !== "number") return null;
  return value as ParticipantMeetingFoodOrdersData;
}

function responseMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

async function responseBody(response: Response): Promise<unknown> {
  return response.json().then((value: unknown) => value, () => null);
}

export async function loadParticipantOrders(meetingId: number): Promise<ParticipantMeetingFoodOrdersData> {
  const response = await fetch(`/api/meetings/${meetingId}/orders`, { cache: "no-store" });
  const body = await responseBody(response);
  const data = participantOrderData(body);
  if (!response.ok || !data) throw new Error(responseMessage(body, "주문 정보를 불러오지 못했습니다."));
  return data;
}

export async function addParticipantOrder(input: {
  readonly meetingId: number;
  readonly participantId: number;
  readonly items: ReadonlyArray<{ readonly menuItemId: number; readonly optionChoiceId: number | null; readonly quantity: number }>;
}): Promise<OrderClientResult> {
  try {
    const response = await fetch(`/api/meetings/${input.meetingId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: input.participantId, items: input.items }),
    });
    const body = await responseBody(response);
    const data = participantOrderData(body);
    if (response.ok && data) return { ok: true, data };
    return {
      ok: false,
      status: response.status,
      code: isRecord(body) && typeof body.code === "string" ? body.code : null,
      message: responseMessage(body, "주문을 저장하지 못했습니다."),
      current: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      code: null,
      message: error instanceof Error ? error.message : "주문을 저장하지 못했습니다.",
      current: null,
    };
  }
}

export async function mutateParticipantOrder(input: {
  readonly meetingId: number;
  readonly orderId: number;
  readonly method: "PATCH" | "DELETE";
  readonly body: unknown;
}): Promise<OrderClientResult> {
  try {
    const response = await fetch(`/api/meetings/${input.meetingId}/orders/${input.orderId}`, {
      method: input.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
    });
    const body = await responseBody(response);
    const record = isRecord(body) ? body : null;
    const data = record ? participantOrderData(record.data) : null;
    if (response.ok && data) {
      return {
        ok: true,
        data,
        replacementOrderId: typeof record?.replacementOrderId === "number" ? record.replacementOrderId : undefined,
      };
    }
    return {
      ok: false,
      status: response.status,
      code: record && typeof record.code === "string" ? record.code : null,
      message: responseMessage(body, "주문을 변경하지 못했습니다."),
      current: record ? participantOrderData(record.current) : null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      code: null,
      message: error instanceof Error ? error.message : "주문을 변경하지 못했습니다.",
      current: null,
    };
  }
}
