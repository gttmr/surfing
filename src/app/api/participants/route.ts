import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

type CompanionOption = { hasLesson?: boolean; hasBus?: boolean; hasRental?: boolean };
type NewCompanion = { name: string; hasLesson?: boolean; hasBus?: boolean; hasRental?: boolean };

export async function POST(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "카카오 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const {
    meetingId,
    name,
    note,
    hasLesson,
    hasBus,
    hasRental,
    companionIds,
    companionOptions,   // { [companionId]: { hasLesson, hasBus, hasRental } }
    newCompanions,      // { name, hasLesson, hasBus, hasRental }[]
  } = body as {
    meetingId: number;
    name: string;
    note?: string;
    hasLesson?: boolean;
    hasBus?: boolean;
    hasRental?: boolean;
    companionIds?: number[];
    companionOptions?: Record<string, CompanionOption>;
    newCompanions?: NewCompanion[];
  };

  if (!meetingId || !name?.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(String(meetingId)) },
    include: { participants: { select: { status: true, kakaoId: true, companionId: true } } },
  });

  if (!meeting) return NextResponse.json({ error: "모임을 찾을 수 없습니다" }, { status: 404 });
  if (!meeting.isOpen) return NextResponse.json({ error: "신청이 마감된 모임입니다" }, { status: 400 });

  const existing = meeting.participants.find((p) => p.kakaoId === user.kakaoId && p.companionId === null && p.status !== "CANCELLED");
  if (existing) {
    return NextResponse.json({ error: "이미 신청하셨습니다" }, { status: 409 });
  }

  // 인라인 새 동반인 생성
  const createdCompanions: { id: number; hasLesson: boolean; hasBus: boolean; hasRental: boolean }[] = [];
  if (Array.isArray(newCompanions) && newCompanions.length > 0) {
    for (const nc of newCompanions) {
      if (!nc?.name?.trim()) continue;
      const newComp = await prisma.companion.create({
        data: { name: nc.name.trim(), ownerKakaoId: user.kakaoId },
      });
      createdCompanions.push({ id: newComp.id, hasLesson: !!nc.hasLesson, hasBus: !!nc.hasBus, hasRental: !!nc.hasRental });
    }
  }

  // 본인 신청 처리
  const cancelledRecord = await prisma.participant.findFirst({
    where: { meetingId: parseInt(String(meetingId)), kakaoId: user.kakaoId, companionId: null, status: "CANCELLED" },
  });

  let participant;
  if (cancelledRecord) {
    participant = await prisma.participant.update({
      where: { id: cancelledRecord.id },
      data: {
        name: name.trim(),
        note: note?.trim() || null,
        hasLesson: !!hasLesson,
        hasBus: !!hasBus,
        hasRental: !!hasRental,
        status: "APPROVED",
        waitlistPosition: null,
        cancelledAt: null,
        submittedAt: new Date(),
      },
    });
  } else {
    participant = await prisma.participant.create({
      data: {
        meetingId: parseInt(String(meetingId)),
        name: name.trim(),
        kakaoId: user.kakaoId,
        kakaoNickname: user.nickname,
        note: note?.trim() || null,
        hasLesson: !!hasLesson,
        hasBus: !!hasBus,
        hasRental: !!hasRental,
        status: "APPROVED",
      },
    });
  }

  // 기존 선택 동반인 신청
  const allCompanionEntries: { id: number; hasLesson: boolean; hasBus: boolean; hasRental: boolean }[] = [
    ...(Array.isArray(companionIds)
      ? companionIds.map((id) => {
          const opt = companionOptions?.[String(id)];
          return { id: parseInt(String(id)), hasLesson: !!opt?.hasLesson, hasBus: !!opt?.hasBus, hasRental: !!opt?.hasRental };
        })
      : []),
    ...createdCompanions,
  ];

  const companionResults: { companionId: number; name: string; status: string }[] = [];

  if (allCompanionEntries.length > 0) {
    const myCompanions = await prisma.companion.findMany({
      where: {
        id: { in: allCompanionEntries.map((e) => e.id) },
        ownerKakaoId: user.kakaoId,
      },
    });

    for (const companion of myCompanions) {
      const opts = allCompanionEntries.find((e) => e.id === companion.id);
      const compExisting = await prisma.participant.findFirst({
        where: { meetingId: parseInt(String(meetingId)), companionId: companion.id, status: { not: "CANCELLED" } },
      });
      if (compExisting) continue;

      const cancelledComp = await prisma.participant.findFirst({
        where: { meetingId: parseInt(String(meetingId)), companionId: companion.id, status: "CANCELLED" },
      });

      if (cancelledComp) {
        await prisma.participant.update({
          where: { id: cancelledComp.id },
          data: {
            hasLesson: opts?.hasLesson ?? false,
            hasBus: opts?.hasBus ?? false,
            hasRental: opts?.hasRental ?? false,
            status: "APPROVED",
            cancelledAt: null,
            submittedAt: new Date(),
          },
        });
      } else {
        await prisma.participant.create({
          data: {
            meetingId: parseInt(String(meetingId)),
            name: companion.name,
            kakaoId: user.kakaoId,
            kakaoNickname: companion.name,
            companionId: companion.id,
            note: `${name.trim()}의 동반`,
            hasLesson: opts?.hasLesson ?? false,
            hasBus: opts?.hasBus ?? false,
            hasRental: opts?.hasRental ?? false,
            status: "APPROVED",
          },
        });
      }

      companionResults.push({ companionId: companion.id, name: companion.name, status: "APPROVED" });
    }
  }

  return NextResponse.json({ ...participant, companions: companionResults }, { status: 201 });
}
