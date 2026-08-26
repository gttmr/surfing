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

  const publication = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      groupDayIndex: true,
      settlementOpen: true,
      billingReviewConfirmedAt: true,
      meetingGroup: {
        select: {
          meetings: {
            orderBy: { groupDayIndex: "asc" },
            select: {
              id: true,
              groupDayIndex: true,
              settlementOpen: true,
              billingReviewConfirmedAt: true,
            },
          },
        },
      },
    },
  });
  if (!publication) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }
  const scopedMeetings = publication.meetingGroup?.meetings ?? [publication];
  const canonicalMeetingId = scopedMeetings.find((item) => item.groupDayIndex === 1)?.id ?? publication.id;
  if (scopedMeetings.some((item) => item.settlementOpen)) {
    return NextResponse.json(
      { error: "공개된 청구는 정정 절차를 시작한 뒤 수정할 수 있습니다." },
      { status: 409 }
    );
  }
  if (scopedMeetings.some((item) => item.billingReviewConfirmedAt)) {
    return NextResponse.json(
      { error: "청구 검토 완료를 취소한 뒤 조정할 수 있습니다." },
      { status: 409 }
    );
  }

  const adjustment = await prisma.participantChargeAdjustment.findUnique({
    where: { id: parsedAdjustmentId },
  });

  if (!adjustment || !scopedMeetings.some((item) => item.id === adjustment.meetingId)) {
    return NextResponse.json({ error: "청구 조정 항목을 찾지 못했습니다." }, { status: 404 });
  }

  await prisma.participantChargeAdjustment.delete({
    where: { id: parsedAdjustmentId },
  });

  await prisma.settlementConfirmation.deleteMany({
    where: { meetingId: canonicalMeetingId },
  });

  return NextResponse.json({ ok: true });
}
