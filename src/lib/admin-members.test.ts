import assert from "node:assert/strict";
import test from "node:test";
import {
  filterAdminMembers,
  getAdminMemberErrorMessage,
  getAdminMemberProtectionCode,
  parseAdminMemberId,
  parseAdminMemberUpdate,
  validateAdminMemberDraft,
  type AdminMemberFilter,
} from "@/lib/admin-members";
import {
  parseAdminMemberDetail,
  readAdminMemberErrorCode,
} from "@/lib/admin-member-response";

const members = [
  {
    id: 1,
    kakaoId: "kakao-admin",
    name: "관리자 파도",
    phoneNumber: "010-1111-2222",
    role: "ADMIN",
    memberType: "REGULAR",
    penaltyCount: 0,
  },
  {
    id: 2,
    kakaoId: "kakao-companion",
    name: "동반인 물결",
    phoneNumber: null,
    role: "MEMBER",
    memberType: "COMPANION",
    penaltyCount: 2,
  },
  {
    id: 3,
    kakaoId: "blocked-member",
    name: null,
    phoneNumber: "010 9999 9999",
    role: "BANNED",
    memberType: "REGULAR",
    penaltyCount: 0,
  },
] as const;

const allFilters = {
  query: "",
  role: "ALL",
  memberType: "ALL",
  status: "ALL",
} satisfies AdminMemberFilter;

test("member filters combine normalized search, role, type, and status", () => {
  assert.deepEqual(
    filterAdminMembers(members, { ...allFilters, query: "  동반인  ", memberType: "COMPANION", status: "PENALTY" }).map((member) => member.id),
    [2],
  );
  assert.deepEqual(
    filterAdminMembers(members, { ...allFilters, query: "010 9999", role: "BANNED", status: "BANNED" }).map((member) => member.id),
    [3],
  );
  assert.deepEqual(
    filterAdminMembers(members, { ...allFilters, status: "ACTIVE" }).map((member) => member.id),
    [1],
  );
});

test("member draft validation returns a normalized save payload", () => {
  const result = validateAdminMemberDraft({
    role: "SHOP_OWNER",
    memberType: "REGULAR",
    phoneNumber: " 010-1234-5678 ",
    penaltyCount: "02",
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.deepEqual(result.value, {
      role: "SHOP_OWNER",
      memberType: "REGULAR",
      phoneNumber: "010-1234-5678",
      penaltyCount: 2,
    });
  }
});

test("member draft validation rejects unsupported choices and malformed numbers", () => {
  const result = validateAdminMemberDraft({
    role: "OWNER",
    memberType: "GUEST",
    phoneNumber: "전화번호 없음",
    penaltyCount: "-1",
  });

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.errors.role, "회원 등급을 다시 선택해 주세요.");
    assert.equal(result.errors.memberType, "회원 유형을 다시 선택해 주세요.");
    assert.equal(result.errors.phoneNumber, "연락처는 숫자와 +, -, 괄호만 입력해 주세요.");
    assert.equal(result.errors.penaltyCount, "패널티는 0~999 사이 숫자로 입력해 주세요.");
  }
});

test("server update parsing accepts partial supported fields and rejects invalid payloads", () => {
  assert.deepEqual(parseAdminMemberUpdate({ role: "MEMBER", penaltyCount: "3" }), {
    ok: true,
    value: { role: "MEMBER", penaltyCount: 3 },
  });
  assert.equal(parseAdminMemberUpdate({ role: "OWNER" }).ok, false);
  assert.equal(parseAdminMemberUpdate({ penaltyCount: 1.5 }).ok, false);
  assert.equal(parseAdminMemberUpdate({ role: "MEMBER", hidden: true }).ok, false);
  assert.equal(parseAdminMemberUpdate({}).ok, false);
  assert.equal(parseAdminMemberId("8205"), 8205);
  assert.equal(parseAdminMemberId("8205-extra"), null);
  assert.equal(parseAdminMemberId("0"), null);
});

test("member response codes map to concise recovery copy", () => {
  assert.equal(getAdminMemberErrorMessage(403, "SELF_ADMIN_PROTECTED"), "현재 로그인한 관리자 권한은 변경하거나 삭제할 수 없습니다.");
  assert.equal(getAdminMemberErrorMessage(409, "LAST_ADMIN_PROTECTED"), "마지막 관리자 한 명은 유지해야 합니다.");
  assert.equal(getAdminMemberErrorMessage(404, null), "회원 정보를 찾지 못했습니다. 목록을 새로 확인해 주세요.");
  assert.equal(getAdminMemberErrorMessage(500, null), "저장하지 못했습니다. 초안은 그대로 유지됩니다.");
});

test("member detail response parsing keeps only the inspection contract", () => {
  const result = parseAdminMemberDetail({
    id: 2,
    kakaoId: "kakao-companion",
    name: "동반인 물결",
    profileImage: null,
    phoneNumber: "010-2222-3333",
    role: "MEMBER",
    memberType: "COMPANION",
    penaltyCount: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    participants: [{
      id: 21,
      name: "동반인 물결",
      status: "APPROVED",
      isPenalized: false,
      submittedAt: "2026-01-02T00:00:00.000Z",
      meeting: { date: "2026-01-02", location: "합성 해변", startTime: "09:00" },
    }],
    ignoredAuthField: "must-not-leak-through-parser",
  });

  assert.equal(result?.id, 2);
  assert.equal(result?.participants[0]?.meeting.location, "합성 해변");
  assert.equal(readAdminMemberErrorCode({ code: "LAST_ADMIN_PROTECTED" }), "LAST_ADMIN_PROTECTED");
  assert.equal(readAdminMemberErrorCode({ code: 409 }), null);
  assert.equal(parseAdminMemberDetail({ id: "2" }), null);
});

test("self-admin and last-admin protections apply only to demotion or deletion", () => {
  assert.equal(getAdminMemberProtectionCode({ action: "update", actorId: 1, actorRole: "ADMIN", targetId: 1, targetRole: "ADMIN", nextRole: "MEMBER", adminCount: 2 }), "SELF_ADMIN_PROTECTED");
  assert.equal(getAdminMemberProtectionCode({ action: "delete", actorId: null, actorRole: null, targetId: 1, targetRole: "ADMIN", adminCount: 1 }), "LAST_ADMIN_PROTECTED");
  assert.equal(getAdminMemberProtectionCode({ action: "update", actorId: 1, actorRole: "ADMIN", targetId: 1, targetRole: "ADMIN", nextRole: "ADMIN", adminCount: 1 }), null);
  assert.equal(getAdminMemberProtectionCode({ action: "update", actorId: 1, actorRole: "ADMIN", targetId: 2, targetRole: "MEMBER", nextRole: "SHOP_OWNER", adminCount: 1 }), null);
});
