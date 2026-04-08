import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import {
  InvalidParticipantOptionsError,
  normalizeParticipantOptions,
} from "@/lib/participant-options";
import { createParticipantWithRecoveredSequence } from "@/lib/participant-sequence";
import { runSerializableTransaction } from "@/lib/transaction";

type CompanionOption = { hasLesson?: boolean; hasBus?: boolean; hasRental?: boolean };
type NewCompanion = { name: string; hasLesson?: boolean; hasBus?: boolean; hasRental?: boolean };

export async function POST(req: NextRequest) {
  const user = await getActiveSessionFromRequest(req);
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

  let mainOptions;
  let normalizedCompanionOptions: Record<string, ReturnType<typeof normalizeParticipantOptions>> = {};
  let normalizedNewCompanions: Array<NewCompanion & ReturnType<typeof normalizeParticipantOptions>> = [];
  try {
    mainOptions = normalizeParticipantOptions({ hasLesson, hasBus, hasRental });
    normalizedCompanionOptions = Object.fromEntries(
      Object.entries(companionOptions ?? {}).map(([companionId, options]) => [
        companionId,
        normalizeParticipantOptions(options),
      ]),
    );
    normalizedNewCompanions = (newCompanions ?? []).map((companion) => ({
      ...companion,
      ...normalizeParticipantOptions(companion),
    }));
  } catch (error) {
    if (error instanceof InvalidParticipantOptionsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const meetingIdNumber = parseInt(String(meetingId));

  const result = await runSerializableTransaction(async (tx) => {
    const meeting = await tx.meeting.findUnique({
      where: { id: meetingIdNumber },
      select: { id: true, isOpen: true },
    });

    if (!meeting) {
      return { status: 404, body: { error: "모임을 찾을 수 없습니다" } };
    }
    if (!meeting.isOpen) {
      return { status: 400, body: { error: "신청이 마감된 모임입니다" } };
    }

    const existing = await tx.participant.findFirst({
      where: {
        meetingId: meetingIdNumber,
        kakaoId: user.kakaoId,
        companionId: null,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (existing) {
      return { status: 409, body: { error: "이미 신청하셨습니다" } };
    }

    const createdCompanions: Array<{ id: number; hasLesson: boolean; hasBus: boolean; hasRental: boolean }> = [];
    for (const newCompanion of normalizedNewCompanions) {
      if (!newCompanion.name?.trim()) continue;
      const createdCompanion = await tx.companion.create({
        data: { name: newCompanion.name.trim(), ownerKakaoId: user.kakaoId },
      });
      createdCompanions.push({
        id: createdCompanion.id,
        hasLesson: newCompanion.hasLesson,
        hasBus: newCompanion.hasBus,
        hasRental: newCompanion.hasRental,
      });
    }

    const cancelledRecord = await tx.participant.findFirst({
      where: {
        meetingId: meetingIdNumber,
        kakaoId: user.kakaoId,
        companionId: null,
        status: "CANCELLED",
      },
    });

    const participant = cancelledRecord
      ? await tx.participant.update({
          where: { id: cancelledRecord.id },
          data: {
            name: name.trim(),
            note: note?.trim() || null,
            ...mainOptions,
            status: "APPROVED",
            waitlistPosition: null,
            cancelledAt: null,
            submittedAt: new Date(),
          },
        })
      : await createParticipantWithRecoveredSequence(tx, {
          meetingId: meetingIdNumber,
          name: name.trim(),
          kakaoId: user.kakaoId,
          kakaoNickname: user.nickname,
          note: note?.trim() || null,
          ...mainOptions,
          status: "APPROVED",
        });

    const allCompanionEntries: Array<{
      id: number;
      hasLesson: boolean;
      hasBus: boolean;
      hasRental: boolean;
    }> = [
      ...(Array.isArray(companionIds)
        ? companionIds.map((id) => {
            const options = normalizedCompanionOptions[String(id)] ?? {
              hasLesson: false,
              hasBus: false,
              hasRental: false,
            };
            return { id: parseInt(String(id)), ...options };
          })
        : []),
      ...createdCompanions,
    ];

    const companionResults: { companionId: number; name: string; status: string }[] = [];

    if (allCompanionEntries.length > 0) {
      const myCompanions = await tx.companion.findMany({
        where: {
          id: { in: allCompanionEntries.map((entry) => entry.id) },
          ownerKakaoId: user.kakaoId,
          archivedAt: null,
        },
      });

      for (const companion of myCompanions) {
        const options = allCompanionEntries.find((entry) => entry.id === companion.id) ?? {
          hasLesson: false,
          hasBus: false,
          hasRental: false,
        };

        const activeCompanionParticipant = await tx.participant.findFirst({
          where: {
            meetingId: meetingIdNumber,
            companionId: companion.id,
            status: { not: "CANCELLED" },
          },
          select: { id: true },
        });
        if (activeCompanionParticipant) continue;

        const cancelledCompanionParticipant = await tx.participant.findFirst({
          where: {
            meetingId: meetingIdNumber,
            companionId: companion.id,
            status: "CANCELLED",
          },
        });

        if (cancelledCompanionParticipant) {
          await tx.participant.update({
            where: { id: cancelledCompanionParticipant.id },
            data: {
              ...options,
              status: "APPROVED",
              cancelledAt: null,
              submittedAt: new Date(),
            },
          });
        } else {
          await createParticipantWithRecoveredSequence(tx, {
            meetingId: meetingIdNumber,
            name: companion.name,
            kakaoId: user.kakaoId,
            kakaoNickname: companion.name,
            companionId: companion.id,
            note: `${name.trim()}의 동반`,
            ...options,
            status: "APPROVED",
          });
        }

        companionResults.push({
          companionId: companion.id,
          name: companion.name,
          status: "APPROVED",
        });
      }
    }

    return {
      status: 201,
      body: { ...participant, companions: companionResults },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
}
