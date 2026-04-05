import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getSettlementGroupsForKakaoId } from "@/lib/settlement";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const meetingId = Number(body?.meetingId);
  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "meetingId가 필요합니다." }, { status: 400 });
  }

  const settlements = await getSettlementGroupsForKakaoId(session.kakaoId);
  const target = settlements.find((item) => item.meeting.id === meetingId);
  if (!target) {
    return NextResponse.json({ error: "정산 대상이 아닙니다." }, { status: 404 });
  }

  await prisma.settlementConfirmation.upsert({
    where: {
      meetingId_recipientKakaoId: {
        meetingId,
        recipientKakaoId: session.kakaoId,
      },
    },
    create: {
      meetingId,
      recipientKakaoId: session.kakaoId,
    },
    update: {
      confirmedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

