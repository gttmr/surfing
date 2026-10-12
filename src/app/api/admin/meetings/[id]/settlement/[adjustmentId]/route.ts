import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; adjustmentId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, adjustmentId } = await params;
  const meetingId = Number(id);
  const parsedAdjustmentId = Number(adjustmentId);

  if (!Number.isInteger(meetingId) || !Number.isInteger(parsedAdjustmentId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { billingPublishedAt: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }
  if (meeting.billingPublishedAt) {
    return NextResponse.json(
      { error: "공개된 청구는 정정 절차를 시작한 뒤 수정할 수 있습니다." },
      { status: 409 }
    );
  }

  const adjustment = await prisma.participantChargeAdjustment.findUnique({
    where: { id: parsedAdjustmentId },
  });

  if (!adjustment || adjustment.meetingId !== meetingId) {
    return NextResponse.json({ error: "청구 조정 항목을 찾지 못했습니다." }, { status: 404 });
  }

  await prisma.participantChargeAdjustment.delete({
    where: { id: parsedAdjustmentId },
  });

  await prisma.settlementConfirmation.deleteMany({
    where: { meetingId },
  });

  return NextResponse.json({ ok: true });
}
