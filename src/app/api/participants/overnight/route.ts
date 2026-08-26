import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { createCompanionWithRecoveredSequence } from "@/lib/companion-sequence";
import { prisma } from "@/lib/db";
import { isOvernightMeetingGroupKind } from "@/lib/meeting-group";
import {
  InvalidParticipantOptionsError,
  normalizeParticipantOptions,
  type ParticipantOptionState,
} from "@/lib/participant-options";
import { createParticipantWithRecoveredSequence } from "@/lib/participant-sequence";
import { runSerializableTransaction } from "@/lib/transaction";

type OvernightOptions = ParticipantOptionState & {
  day2HasRental: boolean;
  usesClubLodging: boolean;
};

type CompanionInput = {
  id: number;
  options: OvernightOptions;
};

type NewCompanionInput = OvernightOptions & {
  name: string;
};

function objectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalBoolean(value: unknown): boolean | null {
  return value === undefined ? false : typeof value === "boolean" ? value : null;
}

function parseOptions(value: unknown): OvernightOptions | null {
  if (!objectValue(value)) return null;
  const hasLesson = optionalBoolean(value.hasLesson);
  const hasBus = optionalBoolean(value.hasBus);
  const hasRental = optionalBoolean(value.hasRental);
  const day2HasRental = optionalBoolean(value.day2HasRental);
  const usesClubLodging = optionalBoolean(value.usesClubLodging);
  if ([hasLesson, hasBus, hasRental, day2HasRental, usesClubLodging].some((item) => item === null)) return null;

  return {
    ...normalizeParticipantOptions({ hasLesson: hasLesson!, hasBus: hasBus!, hasRental: hasRental! }),
    day2HasRental: day2HasRental!,
    usesClubLodging: usesClubLodging!,
  };
}

async function reviveOrCreateParticipant(
  tx: Prisma.TransactionClient,
  input: {
    meetingId: number;
    name: string;
    kakaoId: string;
    kakaoNickname: string;
    companionId: number | null;
    note: string | null;
    options: ParticipantOptionState;
    usesClubLodging: boolean;
  },
) {
  const cancelled = await tx.participant.findFirst({
    where: {
      meetingId: input.meetingId,
      kakaoId: input.kakaoId,
      companionId: input.companionId,
      status: "CANCELLED",
    },
    orderBy: { submittedAt: "desc" },
  });

  if (cancelled) {
    return tx.participant.update({
      where: { id: cancelled.id },
      data: {
        name: input.name,
        kakaoNickname: input.kakaoNickname,
        note: input.note,
        ...input.options,
        usesClubLodging: input.usesClubLodging,
        status: "APPROVED",
        attendanceStatus: "PENDING",
        attendanceUpdatedAt: null,
        attendanceUpdatedByKakaoId: null,
        waitlistPosition: null,
        cancelledAt: null,
        isPenalized: false,
        submittedAt: new Date(),
      },
    });
  }

  return createParticipantWithRecoveredSequence(tx, {
    meetingId: input.meetingId,
    name: input.name,
    kakaoId: input.kakaoId,
    kakaoNickname: input.kakaoNickname,
    companionId: input.companionId,
    note: input.note,
    ...input.options,
    usesClubLodging: input.usesClubLodging,
    status: "APPROVED",
  });
}

export async function GET(req: NextRequest) {
  const user = await getActiveSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "카카오 로그인이 필요합니다" }, { status: 401 });
  const meetingId = Number(req.nextUrl.searchParams.get("meetingId"));
  if (!Number.isSafeInteger(meetingId) || meetingId < 1) {
    return NextResponse.json({ error: "meetingId를 확인해 주세요." }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { meetingGroup: { include: { meetings: { orderBy: { groupDayIndex: "asc" } } } } },
  });
  const day1 = meeting?.meetingGroup?.meetings.find((day) => day.groupDayIndex === 1);
  const day2 = meeting?.meetingGroup?.meetings.find((day) => day.groupDayIndex === 2);
  if (!meeting || !day1 || !day2 || !isOvernightMeetingGroupKind(meeting.meetingGroup?.kind)) {
    return NextResponse.json({ error: "1박2일 모임을 찾을 수 없습니다." }, { status: 404 });
  }

  const participants = await prisma.participant.findMany({
    where: {
      meetingId: { in: [day1.id, day2.id] },
      kakaoId: user.kakaoId,
      status: { not: "CANCELLED" },
    },
  });
  const day1Participants = participants.filter((participant) => participant.meetingId === day1.id);
  const day2Participants = participants.filter((participant) => participant.meetingId === day2.id);
  const self = day1Participants.find((participant) => participant.companionId === null);
  const selfDay2 = day2Participants.find((participant) => participant.companionId === null);
  const signedUpCompanionData = Object.fromEntries(
    day1Participants
      .filter((participant) => participant.companionId !== null)
      .map((participant) => {
        const second = day2Participants.find((item) => item.companionId === participant.companionId);
        return [participant.companionId!, {
          participantId: participant.id,
          day2ParticipantId: second?.id,
          hasLesson: participant.hasLesson,
          hasBus: participant.hasBus,
          hasRental: participant.hasRental,
          day2HasRental: second?.hasRental ?? false,
          usesClubLodging: participant.usesClubLodging,
        }];
      })
  );

  return NextResponse.json({
    myParticipant: self ? {
      id: self.id,
      day2ParticipantId: selfDay2?.id,
      status: self.status,
      waitlistPosition: self.waitlistPosition,
      note: self.note ?? "",
      hasLesson: self.hasLesson,
      hasBus: self.hasBus,
      hasRental: self.hasRental,
      day2HasRental: selfDay2?.hasRental ?? false,
      usesClubLodging: self.usesClubLodging,
    } : null,
    signedUpCompanionData,
  });
}

export async function POST(req: NextRequest) {
  const user = await getActiveSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: "카카오 로그인이 필요합니다" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (!objectValue(body)) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });

  const meetingId = Number(body.meetingId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 100) || null : null;
  if (!Number.isSafeInteger(meetingId) || meetingId < 1 || !name || name.length > 50) {
    return NextResponse.json({ error: "모임과 이름을 확인해 주세요." }, { status: 400 });
  }

  let mainOptions: OvernightOptions | null;
  const companions: CompanionInput[] = [];
  const newCompanions: NewCompanionInput[] = [];
  try {
    mainOptions = parseOptions(body);
    if (!mainOptions) throw new TypeError("invalid options");

    if (body.companionOptions !== undefined) {
      if (!objectValue(body.companionOptions)) throw new TypeError("invalid companion options");
      for (const [idValue, rawOptions] of Object.entries(body.companionOptions)) {
        const id = Number(idValue);
        const options = parseOptions(rawOptions);
        if (!Number.isSafeInteger(id) || id < 1 || !options) throw new TypeError("invalid companion options");
        companions.push({ id, options });
      }
    }

    if (body.newCompanions !== undefined) {
      if (!Array.isArray(body.newCompanions) || body.newCompanions.length > 20) throw new TypeError("invalid new companions");
      for (const rawCompanion of body.newCompanions) {
        const options = parseOptions(rawCompanion);
        const companionName = objectValue(rawCompanion) && typeof rawCompanion.name === "string"
          ? rawCompanion.name.trim()
          : "";
        if (!options || !companionName || companionName.length > 50) throw new TypeError("invalid new companion");
        newCompanions.push({ name: companionName, ...options });
      }
    }
  } catch (error) {
    const message = error instanceof InvalidParticipantOptionsError
      ? error.message
      : "참가 옵션을 확인해 주세요.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await runSerializableTransaction(async (tx) => {
    const requestedMeeting = await tx.meeting.findUnique({
      where: { id: meetingId },
      include: {
        meetingGroup: {
          include: {
            meetings: { orderBy: { groupDayIndex: "asc" } },
          },
        },
      },
    });
    const group = requestedMeeting?.meetingGroup;
    const days = group?.meetings ?? [];
    if (!requestedMeeting || !group || !isOvernightMeetingGroupKind(group.kind) || days.length !== 2) {
      return { status: 404, body: { error: "1박2일 모임을 찾을 수 없습니다." } };
    }
    if (days.some((day) => !day.isOpen)) {
      return { status: 400, body: { error: "신청이 마감된 모임입니다." } };
    }

    const day1 = days.find((day) => day.groupDayIndex === 1);
    const day2 = days.find((day) => day.groupDayIndex === 2);
    if (!day1 || !day2) return { status: 409, body: { error: "1박2일 일정 연결을 확인해 주세요." } };

    const existingSelf = await tx.participant.findFirst({
      where: {
        meetingId: { in: [day1.id, day2.id] },
        kakaoId: user.kakaoId,
        companionId: null,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (existingSelf) return { status: 409, body: { error: "이미 신청하셨습니다." } };

    const companionIds = [...new Set(companions.map((companion) => companion.id))];
    if (companionIds.length !== companions.length) {
      return { status: 400, body: { error: "같은 동반인이 중복 선택되었습니다." } };
    }
    const ownedExistingCompanions = companionIds.length > 0
      ? await tx.companion.findMany({
          where: { id: { in: companionIds }, ownerKakaoId: user.kakaoId, archivedAt: null },
        })
      : [];
    if (ownedExistingCompanions.length !== companionIds.length) {
      return { status: 403, body: { error: "신청할 수 없는 동반인이 포함되어 있습니다." } };
    }

    const activeCompanion = companionIds.length > 0
      ? await tx.participant.findFirst({
          where: {
            meetingId: { in: [day1.id, day2.id] },
            companionId: { in: companionIds },
            status: { not: "CANCELLED" },
          },
          select: { id: true },
        })
      : null;
    if (activeCompanion) {
      return { status: 409, body: { error: "이미 신청된 동반인이 포함되어 있습니다." } };
    }

    const createdCompanions: CompanionInput[] = [];
    const createdCompanionRecords: Array<{ id: number; name: string }> = [];
    for (const companion of newCompanions) {
      const created = await createCompanionWithRecoveredSequence(tx, {
        name: companion.name,
        ownerKakaoId: user.kakaoId,
      });
      createdCompanionRecords.push(created);
      createdCompanions.push({ id: created.id, options: companion });
    }
    const allCompanions = [...companions, ...createdCompanions];
    const ownedCompanions = [...ownedExistingCompanions, ...createdCompanionRecords];

    const createBothDays = async (participant: {
      name: string;
      kakaoNickname: string;
      companionId: number | null;
      note: string | null;
      options: OvernightOptions;
    }) => {
      const first = await reviveOrCreateParticipant(tx, {
        meetingId: day1.id,
        name: participant.name,
        kakaoId: user.kakaoId,
        kakaoNickname: participant.kakaoNickname,
        companionId: participant.companionId,
        note: participant.note,
        options: {
          hasLesson: participant.options.hasLesson,
          hasBus: participant.options.hasBus,
          hasRental: participant.options.hasRental,
        },
        usesClubLodging: participant.options.usesClubLodging,
      });
      const second = await reviveOrCreateParticipant(tx, {
        meetingId: day2.id,
        name: participant.name,
        kakaoId: user.kakaoId,
        kakaoNickname: participant.kakaoNickname,
        companionId: participant.companionId,
        note: participant.note,
        options: {
          hasLesson: false,
          hasBus: participant.options.hasBus,
          hasRental: participant.options.day2HasRental,
        },
        usesClubLodging: participant.options.usesClubLodging,
      });
      return { first, second };
    };

    const self = await createBothDays({
      name,
      kakaoNickname: user.nickname,
      companionId: null,
      note,
      options: mainOptions,
    });
    const companionResults: Array<{ companionId: number; name: string; status: string }> = [];
    for (const entry of allCompanions) {
      const companion = ownedCompanions.find((item) => item.id === entry.id)!;
      await createBothDays({
        name: companion.name,
        kakaoNickname: companion.name,
        companionId: companion.id,
        note: `${name}의 동반`,
        options: entry.options,
      });
      companionResults.push({ companionId: companion.id, name: companion.name, status: "APPROVED" });
    }

    return {
      status: 201,
      body: {
        ...self.first,
        day2ParticipantId: self.second.id,
        day2HasRental: self.second.hasRental,
        usesClubLodging: self.first.usesClubLodging,
        companions: companionResults,
      },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
}
