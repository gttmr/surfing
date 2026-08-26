import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { getSettlementGroupsForKakaoId } from "@/lib/settlement";

export async function POST(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const meetingId = Number(body?.meetingId);
  const reported = typeof body?.reported === "boolean"
    ? body.reported
    : typeof body?.completed === "boolean"
      ? body.completed
      : true;
  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "meetingId가 필요합니다." }, { status: 400 });
  }

  const settlements = await getSettlementGroupsForKakaoId(session.kakaoId);
  const target = settlements.find((item) => item.meeting.id === meetingId);
  if (!target) {
    return NextResponse.json({ error: "청구 대상이 아닙니다." }, { status: 404 });
  }
  if (target.group.totalFee === 0) {
    return NextResponse.json({ error: "회원 부담이 0원인 청구는 입금 알림이 필요하지 않습니다." }, { status: 409 });
  }

  const key = {
    meetingId_recipientKakaoId: {
      meetingId,
      recipientKakaoId: session.kakaoId,
    },
  };

  if (!reported) {
    const existing = await prisma.settlementConfirmation.findUnique({ where: key });
    if (existing?.verifiedAt) {
      return NextResponse.json(
        { error: "입금 확인이 완료되어 운영진에게 정정을 요청해야 합니다." },
        { status: 409 }
      );
    }
    await prisma.settlementConfirmation.deleteMany({
      where: {
        meetingId,
        recipientKakaoId: session.kakaoId,
      },
    });
    return NextResponse.json({
      ok: true,
      reported: false,
      verified: false,
      paymentStatus: "PAYMENT_REQUIRED",
      completed: false,
    });
  }

  const confirmation = await prisma.settlementConfirmation.upsert({
    where: key,
    create: {
      meetingId,
      recipientKakaoId: session.kakaoId,
    },
    update: {
      confirmedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    reported: true,
    reportedAt: confirmation.confirmedAt.toISOString(),
    verified: confirmation.verifiedAt !== null,
    verifiedAt: confirmation.verifiedAt?.toISOString() ?? null,
    paymentStatus: confirmation.verifiedAt ? "VERIFIED" : "REPORTED",
    completed: confirmation.verifiedAt !== null,
  });
}
