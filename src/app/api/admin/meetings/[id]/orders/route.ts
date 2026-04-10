import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  applyMeetingOrderAction,
  getAdminMeetingFoodOrdersData,
  type MeetingOrderAction,
} from "@/lib/food-ordering-data";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임입니다." }, { status: 400 });
  }

  const data = await getAdminMeetingFoodOrdersData(meetingId);
  if (!data) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);
  const body = await req.json();
  const participantId = Number(body?.participantId);
  const menuItemId = Number(body?.menuItemId);
  const action = body?.action as MeetingOrderAction | undefined;

  if (!Number.isInteger(meetingId) || !Number.isInteger(participantId) || !Number.isInteger(menuItemId) || !action) {
    return NextResponse.json({ error: "participantId, menuItemId, action이 필요합니다." }, { status: 400 });
  }

  try {
    const data = await applyMeetingOrderAction(meetingId, participantId, menuItemId, action);
    if (!data) {
      return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "주문 상태를 바꾸지 못했습니다." },
      { status: 400 }
    );
  }
}
