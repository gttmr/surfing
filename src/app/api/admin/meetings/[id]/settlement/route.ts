import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminSettlementData } from "@/lib/admin-page-data";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }

  const data = await getAdminSettlementData(meetingId);
  if (!data) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const settlementOpen = Boolean(body?.settlementOpen);

  const meeting = await prisma.meeting.update({
    where: { id: meetingId },
    data: { settlementOpen },
  });

  if (settlementOpen) {
    await prisma.settlementConfirmation.deleteMany({
      where: { meetingId },
    });
  }

  return NextResponse.json({
    id: meeting.id,
    settlementOpen: meeting.settlementOpen,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }

  const body = await req.json();
  const participantId = Number(body.participantId);
  const label = String(body.label ?? "").trim();
  const amount = Number(body.amount);

  if (!Number.isInteger(participantId) || !label || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "participantId, label, amount가 필요합니다." }, { status: 400 });
  }

  const participant = await prisma.participant.findFirst({
    where: {
      id: participantId,
      meetingId,
      status: "APPROVED",
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "정산할 참가자를 찾지 못했습니다." }, { status: 404 });
  }

  const adjustment = await prisma.participantChargeAdjustment.create({
    data: {
      meetingId,
      participantId,
      label,
      amount,
    },
  });

  await prisma.settlementConfirmation.deleteMany({
    where: { meetingId },
  });

  return NextResponse.json(adjustment, { status: 201 });
}
