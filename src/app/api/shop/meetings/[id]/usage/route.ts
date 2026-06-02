import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { canAccessShopPortalFromRequest } from "@/lib/auth";
import {
  confirmShopParticipantSurfUsage,
  getShopMeetingSurfUsageData,
  saveShopParticipantSurfUsage,
} from "@/lib/surf-usage-data";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canAccessShopPortalFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임입니다." }, { status: 400 });
  }

  const data = await getShopMeetingSurfUsageData(meetingId);
  if (!data) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canAccessShopPortalFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);
  const body = await req.json();
  const participantId = Number(body?.participantId);
  const action = typeof body?.action === "string" ? body.action : "";

  if (!Number.isInteger(meetingId) || !Number.isInteger(participantId)) {
    return NextResponse.json({ error: "participantId가 필요합니다." }, { status: 400 });
  }

  try {
    const session = await getActiveSessionFromRequest(req);

    if (action === "save") {
      await saveShopParticipantSurfUsage(meetingId, participantId, body?.items, session?.kakaoId ?? null);
    } else if (action === "confirm") {
      await confirmShopParticipantSurfUsage(meetingId, participantId, session?.kakaoId ?? null);
    } else {
      return NextResponse.json({ error: "지원하지 않는 action입니다." }, { status: 400 });
    }

    const data = await getShopMeetingSurfUsageData(meetingId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이용 내역을 변경하지 못했습니다." },
      { status: 400 }
    );
  }
}
