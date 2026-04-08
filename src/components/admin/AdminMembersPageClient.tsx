"use client";

import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import type { AdminMemberListItem } from "@/lib/admin-page-data";

interface UserDetail extends Omit<AdminMemberListItem, "_count"> {
  participants: {
    id: number;
    name: string;
    status: string;
    isPenalized: boolean;
    submittedAt: string;
    meeting: { date: string; location: string; startTime: string };
  }[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  MEMBER: "일반 회원",
  BANNED: "차단됨",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "brand-chip-dark",
  MEMBER: "brand-chip-soft",
  BANNED: "brand-chip-danger",
};

const MEMBER_TYPE_LABELS: Record<string, string> = {
  REGULAR: "정회원",
  COMPANION: "동반인",
};

const MEMBER_TYPE_COLORS: Record<string, string> = {
  REGULAR: "brand-chip-soft",
  COMPANION: "brand-chip-companion",
};

export function AdminMembersPageClient({
  initialUsers,
}: {
  initialUsers: AdminMemberListItem[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function loadDetail(userId: number) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${userId}`);
      if (!res.ok) throw new Error("load_failed");
      const data = (await res.json()) as UserDetail;
      setSelectedUser(data);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    await fetch(`/api/admin/members/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user)));
    setSelectedUser((prev) => (prev?.id === userId ? { ...prev, role: newRole } : prev));
  }

  async function handleMemberTypeChange(userId: number, newMemberType: string) {
    const targetUser = users.find((user) => user.id === userId) ?? selectedUser;
    if (targetUser?.memberType === newMemberType) return;

    if (targetUser?.memberType === "REGULAR" && newMemberType === "COMPANION") {
      const confirmed = confirm(
        "이 회원을 동반인으로 변경할까요?\n소속 정회원 연결은 해당 사용자가 로그인 후 프로필에서 직접 설정하게 됩니다."
      );
      if (!confirmed) return;
    }

    await fetch(`/api/admin/members/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberType: newMemberType }),
    });

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, memberType: newMemberType } : user))
    );
    setSelectedUser((prev) =>
      prev?.id === userId ? { ...prev, memberType: newMemberType } : prev
    );
  }

  async function handleResetPenalty(userId: number) {
    await fetch(`/api/admin/members/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ penaltyCount: 0 }),
    });

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, penaltyCount: 0 } : user))
    );
    setSelectedUser((prev) => (prev?.id === userId ? { ...prev, penaltyCount: 0 } : prev));
  }

  async function handleDeleteUser(userId: number) {
    const target = users.find((user) => user.id === userId);
    const confirmed = confirm(
      `${target?.name || "이 회원"}을(를) 삭제하시겠습니까?\n참가 기록과 소유한 동반인 정보도 함께 정리됩니다.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/admin/members/${userId}`, { method: "DELETE" });
    if (!res.ok) return;

    setUsers((prev) => prev.filter((user) => user.id !== userId));
    setSelectedUser((prev) => (prev?.id === userId ? null : prev));
  }

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const query = search.toLowerCase();

    return users.filter((user) => {
      return (
        user.name?.toLowerCase().includes(query) ||
        user.kakaoId.includes(query) ||
        user.phoneNumber?.includes(query)
      );
    });
  }, [search, users]);

  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const bannedCount = users.filter((user) => user.role === "BANNED").length;
  const penaltyCount = users.filter((user) => user.penaltyCount > 0).length;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">
            회원 관리
          </h1>
          <p className="brand-text-muted mt-1 text-sm">
            회원 유형, 권한, 활동 이력을 한 화면에서 관리합니다.
          </p>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="brand-chip-accent rounded-full px-2.5 py-1">전체 {users.length}</span>
          {adminCount > 0 && (
            <span className="brand-chip-dark rounded-full px-2.5 py-1">관리자 {adminCount}</span>
          )}
          {penaltyCount > 0 && (
            <span className="brand-chip-danger rounded-full px-2.5 py-1">패널티 {penaltyCount}</span>
          )}
          {bannedCount > 0 && (
            <span className="brand-chip-danger rounded-full px-2.5 py-1">차단 {bannedCount}</span>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 카카오ID, 연락처로 검색..."
          className="brand-input w-full rounded-2xl px-4 py-2.5 text-sm outline-none transition-colors"
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          {filteredUsers.length === 0 ? (
            <div className="brand-card-soft rounded-3xl p-8 text-center">
              <div className="mb-3 text-4xl">👤</div>
              <p className="brand-text-muted font-medium">등록된 회원이 없습니다</p>
              <p className="brand-text-subtle mt-1 text-sm">
                카카오 로그인을 한 사용자가 자동으로 등록됩니다
              </p>
            </div>
          ) : (
            <div className="brand-card-soft overflow-hidden rounded-3xl">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => loadDetail(user.id)}
                  className={`brand-list-row flex w-full items-center gap-3 p-4 text-left transition-colors last:border-b-0 ${
                    selectedUser?.id === user.id
                      ? "brand-list-item-active"
                      : "hover:bg-[var(--brand-primary-soft)]/40"
                  }`}
                >
                  <div className="brand-avatar-shell flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    {user.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg">🏄</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-[var(--brand-text)]">
                        {user.name || "이름 없음"}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ROLE_COLORS[user.role] || "brand-chip-accent"}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${MEMBER_TYPE_COLORS[user.memberType] || "brand-chip-accent"}`}>
                        {MEMBER_TYPE_LABELS[user.memberType] || user.memberType}
                      </span>
                      {user.penaltyCount > 0 && (
                        <span className="brand-chip-danger rounded px-1.5 py-0.5 text-[10px] font-bold">
                          패널티 {user.penaltyCount}
                        </span>
                      )}
                    </div>
                    <p className="brand-text-subtle flex items-center gap-1.5 text-xs">
                      모임 {user._count.participants}회
                    </p>
                  </div>
                  <span className="brand-text-subtle text-sm">›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedUser ? (
          <div className="shrink-0 lg:w-96">
            <div className="brand-card-soft sticky top-24 rounded-3xl p-6">
              {detailLoading ? (
                <div className="brand-text-subtle py-8 text-center text-sm">불러오는 중...</div>
              ) : (
                <>
                  <div className="mb-6 flex items-center gap-4">
                    <div className="brand-avatar-shell flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
                      {selectedUser.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedUser.profileImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-3xl">🏄</span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-[var(--brand-text)]">
                        {selectedUser.name || "이름 없음"}
                      </h2>
                      <p className="brand-text-subtle mt-0.5 text-xs">카카오 ID: {selectedUser.kakaoId}</p>
                      <p className="brand-text-subtle text-xs">
                        가입일: {new Date(selectedUser.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                      {selectedUser.penaltyCount > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="brand-chip-danger rounded-full px-2 py-0.5 text-xs font-bold">
                            패널티 {selectedUser.penaltyCount}회
                          </span>
                          <button
                            onClick={() => handleResetPenalty(selectedUser.id)}
                            className="brand-link text-xs underline"
                          >
                            초기화
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="brand-text-muted mb-2 block text-xs font-bold">회원 유형</label>
                    <div className="flex gap-2">
                      {(["REGULAR", "COMPANION"] as const).map((memberType) => (
                        <button
                          key={memberType}
                          onClick={() => handleMemberTypeChange(selectedUser.id, memberType)}
                          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                            selectedUser.memberType === memberType
                              ? "bg-[var(--brand-primary-soft-strong)] text-[var(--brand-primary-text)] shadow-sm"
                              : "brand-button-secondary"
                          }`}
                        >
                          {MEMBER_TYPE_LABELS[memberType]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="brand-text-muted mb-2 block text-xs font-bold">회원 등급</label>
                    <div className="flex flex-wrap gap-2">
                      {(["MEMBER", "ADMIN", "BANNED"] as const).map((role) => (
                        <button
                          key={role}
                          onClick={() => handleRoleChange(selectedUser.id, role)}
                          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                            selectedUser.role === role
                              ? role === "BANNED"
                                ? "brand-button-danger-solid shadow-sm"
                                : role === "ADMIN"
                                  ? "brand-chip-dark"
                                  : "brand-chip-soft"
                              : "brand-button-secondary"
                          }`}
                        >
                          {ROLE_LABELS[role]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="brand-text-muted mb-2 block text-xs font-bold">회원 삭제</label>
                    <button
                      onClick={() => handleDeleteUser(selectedUser.id)}
                      className="brand-button-danger w-full rounded-xl px-4 py-2.5 text-sm font-bold transition-colors"
                      type="button"
                    >
                      회원 삭제하기
                    </button>
                  </div>

                  <div>
                    <h3 className="brand-text-muted mb-3 text-xs font-bold">활동 이력</h3>
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                      {selectedUser.participants.length === 0 ? (
                        <p className="brand-text-subtle py-4 text-center text-xs">활동 내역이 없습니다</p>
                      ) : (
                        selectedUser.participants.map((participant) => (
                          <div key={participant.id} className="brand-list-item rounded-xl p-3 text-xs">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="brand-link font-bold">모임</span>
                              <span className={`rounded px-1.5 py-0.5 font-bold ${
                                participant.status === "APPROVED"
                                  ? "brand-chip-success"
                                  : participant.status === "WAITLISTED"
                                    ? "brand-chip-soft"
                                    : "bg-[var(--brand-dimmed-surface)] text-[var(--brand-dimmed-text)]"
                              }`}>
                                {participant.status === "APPROVED"
                                  ? "참석"
                                  : participant.status === "WAITLISTED"
                                    ? "대기"
                                    : "취소"}
                              </span>
                              {participant.isPenalized ? (
                                <span className="brand-chip-danger rounded px-1.5 py-0.5 font-bold">
                                  패널티
                                </span>
                              ) : null}
                            </div>
                            <p className="brand-text-muted">
                              {participant.meeting.date} · {participant.meeting.startTime} · {participant.meeting.location}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
