import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPricingConfig, getParticipantChargeBreakdown, groupParticipantsForSettlement } from "@/lib/pricing";

function sortWithCompanions<T extends { id: number; kakaoId: string; companionId: number | null }>(items: T[]) {
  const regulars = items.filter((item) => item.companionId === null);
  const companions = items.filter((item) => item.companionId !== null);
  const result: T[] = [];

  for (const regular of regulars) {
    result.push(regular);
    result.push(...companions.filter((companion) => companion.kakaoId === regular.kakaoId));
  }

  const placed = new Set(result.map((item) => item.id));
  for (const companion of companions) {
    if (!placed.has(companion.id)) result.push(companion);
  }

  return result;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }

  const [meeting, pricing] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          where: { status: "APPROVED" },
          orderBy: { submittedAt: "asc" },
          include: {
            user: {
              select: {
                memberType: true,
                name: true,
              },
            },
            companion: {
              include: {
                owner: {
                  select: {
                    kakaoId: true,
                    name: true,
                  },
                },
              },
            },
            chargeAdjustments: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
    getPricingConfig(),
  ]);

  if (!meeting) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  const adjustmentMap = new Map(
    meeting.participants.map((participant) => [
      participant.id,
      participant.chargeAdjustments.map((adjustment) => ({
        id: adjustment.id,
        label: adjustment.label,
        amount: adjustment.amount,
      })),
    ])
  );

  const recipients = groupParticipantsForSettlement(meeting.participants, pricing, adjustmentMap);
  const participants = sortWithCompanions(meeting.participants).map((participant) => {
    const adjustments = adjustmentMap.get(participant.id) ?? [];
    const adjustmentFee = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
    const breakdown = getParticipantChargeBreakdown(participant, pricing, adjustmentFee);

    return {
      id: participant.id,
      name: participant.name,
      kakaoId: participant.kakaoId,
      companionId: participant.companionId,
      hasLesson: participant.hasLesson,
      hasBus: participant.hasBus,
      hasRental: participant.hasRental,
      adjustments,
      breakdown,
    };
  });

  return NextResponse.json({
    meeting: {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
    },
    participants,
    recipients,
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

  return NextResponse.json(adjustment, { status: 201 });
}
