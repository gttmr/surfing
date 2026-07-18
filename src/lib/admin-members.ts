export const ADMIN_MEMBER_ROLES = ["ADMIN", "SHOP_OWNER", "MEMBER", "BANNED"] as const;
export const ADMIN_MEMBER_TYPES = ["REGULAR", "COMPANION"] as const;

export type AdminMemberRole = (typeof ADMIN_MEMBER_ROLES)[number];
export type AdminMemberType = (typeof ADMIN_MEMBER_TYPES)[number];
export type AdminMemberStatusFilter = "ALL" | "ACTIVE" | "PENALTY" | "BANNED";

export type AdminMemberFilter = {
  readonly query: string;
  readonly role: "ALL" | AdminMemberRole;
  readonly memberType: "ALL" | AdminMemberType;
  readonly status: AdminMemberStatusFilter;
};

export type AdminMemberFilterItem = {
  readonly id: number;
  readonly kakaoId: string;
  readonly name: string | null;
  readonly phoneNumber: string | null;
  readonly role: string;
  readonly memberType: string;
  readonly penaltyCount: number;
};

export type AdminMemberDraft = {
  readonly role: string;
  readonly memberType: string;
  readonly phoneNumber: string;
  readonly penaltyCount: string;
};

export type AdminMemberUpdate = {
  readonly role?: AdminMemberRole;
  readonly memberType?: AdminMemberType;
  readonly phoneNumber?: string | null;
  readonly penaltyCount?: number;
};

type DraftField = keyof AdminMemberDraft;
type DraftValidation =
  | { readonly valid: true; readonly value: Required<AdminMemberUpdate> }
  | { readonly valid: false; readonly errors: Partial<Record<DraftField, string>> };
type UpdateParseResult =
  | { readonly ok: true; readonly value: AdminMemberUpdate }
  | { readonly ok: false; readonly message: string };

type AdminProtectionInput = {
  readonly action: "update" | "delete";
  readonly actorId: number | null;
  readonly actorRole: string | null;
  readonly targetId: number;
  readonly targetRole: string;
  readonly nextRole?: AdminMemberRole;
  readonly adminCount: number;
};

function parseRole(value: unknown): AdminMemberRole | null {
  return ADMIN_MEMBER_ROLES.find((role) => role === value) ?? null;
}

function parseMemberType(value: unknown): AdminMemberType | null {
  return ADMIN_MEMBER_TYPES.find((memberType) => memberType === value) ?? null;
}

function normalizePhoneNumber(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length === 0 ? null : normalized;
}

function phoneNumberError(value: string | null): string | null {
  if (value === null) return null;
  if (value.length > 20 || !/^[0-9+() -]{7,20}$/.test(value)) {
    return "연락처는 숫자와 +, -, 괄호만 입력해 주세요.";
  }
  return null;
}

function parsePenaltyCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= 999 ? value : null;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 999 ? parsed : null;
}

function matchesStatus(member: AdminMemberFilterItem, status: AdminMemberStatusFilter): boolean {
  switch (status) {
    case "ALL":
      return true;
    case "ACTIVE":
      return member.role !== "BANNED" && member.penaltyCount === 0;
    case "PENALTY":
      return member.role !== "BANNED" && member.penaltyCount > 0;
    case "BANNED":
      return member.role === "BANNED";
  }
}

export function filterAdminMembers<T extends AdminMemberFilterItem>(
  members: readonly T[],
  filter: AdminMemberFilter,
): readonly T[] {
  const query = filter.query.trim().toLocaleLowerCase("ko-KR");
  return members.filter((member) => {
    const searchable = [member.name ?? "", member.kakaoId, member.phoneNumber ?? ""]
      .join(" ")
      .toLocaleLowerCase("ko-KR");
    return (
      (query.length === 0 || searchable.includes(query))
      && (filter.role === "ALL" || member.role === filter.role)
      && (filter.memberType === "ALL" || member.memberType === filter.memberType)
      && matchesStatus(member, filter.status)
    );
  });
}

export function createAdminMemberDraft(member: AdminMemberFilterItem): AdminMemberDraft {
  return {
    role: member.role,
    memberType: member.memberType,
    phoneNumber: member.phoneNumber ?? "",
    penaltyCount: String(member.penaltyCount),
  };
}

export function validateAdminMemberDraft(draft: AdminMemberDraft): DraftValidation {
  const role = parseRole(draft.role);
  const memberType = parseMemberType(draft.memberType);
  const phoneNumber = normalizePhoneNumber(draft.phoneNumber);
  const phoneError = phoneNumberError(phoneNumber);
  const penaltyCount = parsePenaltyCount(draft.penaltyCount);
  const errors: Partial<Record<DraftField, string>> = {};
  if (!role) errors.role = "회원 등급을 다시 선택해 주세요.";
  if (!memberType) errors.memberType = "회원 유형을 다시 선택해 주세요.";
  if (phoneError) errors.phoneNumber = phoneError;
  if (penaltyCount === null) errors.penaltyCount = "패널티는 0~999 사이 숫자로 입력해 주세요.";
  if (!role || !memberType || penaltyCount === null || phoneError) return { valid: false, errors };
  return { valid: true, value: { role, memberType, phoneNumber, penaltyCount } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAdminMemberUpdate(value: unknown): UpdateParseResult {
  if (!isRecord(value)) return { ok: false, message: "요청 형식을 확인해 주세요." };
  const supportedKeys = ["role", "memberType", "phoneNumber", "penaltyCount"] as const;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !supportedKeys.some((supportedKey) => supportedKey === key))) {
    return { ok: false, message: "변경할 회원 정보를 확인해 주세요." };
  }

  const hasRole = Object.hasOwn(value, "role");
  const hasMemberType = Object.hasOwn(value, "memberType");
  const hasPhoneNumber = Object.hasOwn(value, "phoneNumber");
  const hasPenaltyCount = Object.hasOwn(value, "penaltyCount");
  const role = hasRole ? parseRole(value.role) : undefined;
  const memberType = hasMemberType ? parseMemberType(value.memberType) : undefined;
  const rawPhoneNumber = hasPhoneNumber && typeof value.phoneNumber === "string"
    ? normalizePhoneNumber(value.phoneNumber)
    : hasPhoneNumber && value.phoneNumber === null ? null : undefined;
  const penaltyCount = hasPenaltyCount ? parsePenaltyCount(value.penaltyCount) : undefined;

  if ((hasRole && !role) || (hasMemberType && !memberType)) {
    return { ok: false, message: "허용된 회원 등급과 유형만 선택해 주세요." };
  }
  if (hasPhoneNumber && rawPhoneNumber === undefined) {
    return { ok: false, message: "연락처 형식을 확인해 주세요." };
  }
  const phoneError = rawPhoneNumber === undefined ? null : phoneNumberError(rawPhoneNumber);
  if (phoneError) return { ok: false, message: phoneError };
  if (hasPenaltyCount && penaltyCount === null) {
    return { ok: false, message: "패널티는 0~999 사이 정수여야 합니다." };
  }

  return {
    ok: true,
    value: {
      ...(role ? { role } : {}),
      ...(memberType ? { memberType } : {}),
      ...(rawPhoneNumber !== undefined ? { phoneNumber: rawPhoneNumber } : {}),
      ...(penaltyCount !== undefined && penaltyCount !== null ? { penaltyCount } : {}),
    },
  };
}

export function parseAdminMemberId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function getAdminMemberProtectionCode(input: AdminProtectionInput): "SELF_ADMIN_PROTECTED" | "LAST_ADMIN_PROTECTED" | null {
  const removesAdmin = input.targetRole === "ADMIN"
    && (input.action === "delete" || (input.nextRole !== undefined && input.nextRole !== "ADMIN"));
  if (!removesAdmin) return null;
  if (input.actorRole === "ADMIN" && input.actorId === input.targetId) return "SELF_ADMIN_PROTECTED";
  return input.adminCount <= 1 ? "LAST_ADMIN_PROTECTED" : null;
}

export function getAdminMemberErrorMessage(status: number, code: string | null): string {
  if (code === "SELF_ADMIN_PROTECTED") return "현재 로그인한 관리자 권한은 변경하거나 삭제할 수 없습니다.";
  if (code === "LAST_ADMIN_PROTECTED") return "마지막 관리자 한 명은 유지해야 합니다.";
  if (status === 400) return "입력 내용을 확인해 주세요. 초안은 그대로 유지됩니다.";
  if (status === 404) return "회원 정보를 찾지 못했습니다. 목록을 새로 확인해 주세요.";
  if (status === 403) return "이 회원 정보를 변경할 권한이 없습니다.";
  return "저장하지 못했습니다. 초안은 그대로 유지됩니다.";
}
