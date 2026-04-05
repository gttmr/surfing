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

  const adjustment = await prisma.participantChargeAdjustment.findUnique({
    where: { id: parsedAdjustmentId },
  });

  if (!adjustment || adjustment.meetingId !== meetingId) {
    return NextResponse.json({ error: "정산 항목을 찾지 못했습니다." }, { status: 404 });
  }

  await prisma.participantChargeAdjustment.delete({
    where: { id: parsedAdjustmentId },
  });

  return NextResponse.json({ ok: true });
}
