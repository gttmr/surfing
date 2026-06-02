import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import {
  getParticipantMeetingSurfUsageData,
  submitParticipantSurfUsage,
} from "@/lib/surf-usage-data";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임입니다." }, { status: 400 });
  }

  const data = await getParticipantMeetingSurfUsageData(meetingId, session.kakaoId);
  if (!data) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);
  const body = await req.json();
  const participantId = Number(body?.participantId);

  if (!Number.isInteger(meetingId) || !Number.isInteger(participantId)) {
    return NextResponse.json({ error: "participantId가 필요합니다." }, { status: 400 });
  }

  try {
    await submitParticipantSurfUsage(meetingId, participantId, body?.items, session.kakaoId);
    const data = await getParticipantMeetingSurfUsageData(meetingId, session.kakaoId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이용 내역을 저장하지 못했습니다." },
      { status: 400 }
    );
  }
}
