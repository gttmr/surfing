export type AdminMemberActivity = {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly isPenalized: boolean;
  readonly submittedAt: string;
  readonly meeting: {
    readonly date: string;
    readonly location: string;
    readonly startTime: string;
  };
};

export type AdminMemberDetail = {
  readonly id: number;
  readonly kakaoId: string;
  readonly name: string | null;
  readonly profileImage: string | null;
  readonly phoneNumber: string | null;
  readonly role: string;
  readonly memberType: string;
  readonly penaltyCount: number;
  readonly createdAt: string;
  readonly participants: readonly AdminMemberActivity[];
};

export type AdminMemberErrorCode = "SELF_ADMIN_PROTECTED" | "LAST_ADMIN_PROTECTED";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalString(value: unknown): string | null | undefined {
  return typeof value === "string" || value === null ? value : undefined;
}

function parseActivity(value: unknown): AdminMemberActivity | null {
  if (!isRecord(value) || !isRecord(value.meeting)) return null;
  if (
    !isNumber(value.id)
    || typeof value.name !== "string"
    || typeof value.status !== "string"
    || typeof value.isPenalized !== "boolean"
    || typeof value.submittedAt !== "string"
    || typeof value.meeting.date !== "string"
    || typeof value.meeting.location !== "string"
    || typeof value.meeting.startTime !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    status: value.status,
    isPenalized: value.isPenalized,
    submittedAt: value.submittedAt,
    meeting: {
      date: value.meeting.date,
      location: value.meeting.location,
      startTime: value.meeting.startTime,
    },
  };
}

export function parseAdminMemberDetail(value: unknown): AdminMemberDetail | null {
  if (!isRecord(value) || !Array.isArray(value.participants)) return null;
  const name = optionalString(value.name);
  const profileImage = optionalString(value.profileImage);
  const phoneNumber = optionalString(value.phoneNumber);
  if (
    !isNumber(value.id)
    || typeof value.kakaoId !== "string"
    || name === undefined
    || profileImage === undefined
    || phoneNumber === undefined
    || typeof value.role !== "string"
    || typeof value.memberType !== "string"
    || !isNumber(value.penaltyCount)
    || typeof value.createdAt !== "string"
  ) {
    return null;
  }

  const participants: AdminMemberActivity[] = [];
  for (const candidate of value.participants) {
    const activity = parseActivity(candidate);
    if (!activity) return null;
    participants.push(activity);
  }
  return {
    id: value.id,
    kakaoId: value.kakaoId,
    name,
    profileImage,
    phoneNumber,
    role: value.role,
    memberType: value.memberType,
    penaltyCount: value.penaltyCount,
    createdAt: value.createdAt,
    participants,
  };
}

export function readAdminMemberErrorCode(value: unknown): AdminMemberErrorCode | null {
  if (!isRecord(value)) return null;
  if (value.code === "SELF_ADMIN_PROTECTED") return value.code;
  if (value.code === "LAST_ADMIN_PROTECTED") return value.code;
  return null;
}
