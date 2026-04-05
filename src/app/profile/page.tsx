"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProfileImageUploader } from "@/components/profile/ProfileImageUploader";

interface UserProfile {
  id: number;
  kakaoId: string;
  name: string | null;
  profileImage: string | null;
  kakaoProfileImage: string | null;
  customProfileImageUrl: string | null;
  phoneNumber: string | null;
  role: string;
  memberType: string;
  penaltyCount: number;
  createdAt: string;
  _count: {
    participants: number;
  };
}

interface CompanionItem {
  id: number;
  name: string;
  ownerKakaoId: string;
  linkedKakaoId: string | null;
  createdAt: string;
}

interface RegularMember {
  kakaoId: string;
  name: string | null;
}

interface OwnerCompanion {
  id: number;
  name: string;
  linkedKakaoId: string | null;
}

interface LinkedCompanionInfo {
  linked: boolean;
  companion?: {
    id: number;
    name: string;
    owner: {
      kakaoId: string;
      name: string | null;
    };
  };
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.477 2 10.857c0 2.713 1.584 5.1 3.988 6.577L5 21l4.29-2.287C10.145 18.9 11.058 19 12 19c5.523 0 10-3.477 10-7.143C22 6.477 17.523 3 12 3z" />
    </svg>
  );
}

const MEMBER_TYPE_LABELS: Record<string, string> = {
  REGULAR: "정회원",
  COMPANION: "동반인",
};
const MEMBER_TYPE_COLORS: Record<string, string> = {
  REGULAR: "brand-chip-soft",
  COMPANION: "brand-chip-companion",
};

export default function ProfilePageWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[var(--brand-page)]"><p className="brand-text-subtle text-sm">불러오는 중...</p></div>}>
      <ProfilePage />
    </Suspense>
  );
}

function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get("setup") === "true";
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "companions">("profile");

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // 최초 가입 설정
  const [setupMemberType, setSetupMemberType] = useState<"REGULAR" | "COMPANION">("REGULAR");

  // 동반인 설정 - 정회원 선택 단계
  const [regularMembers, setRegularMembers] = useState<RegularMember[]>([]);
  const [selectedOwnerKakaoId, setSelectedOwnerKakaoId] = useState<string | null>(null);

  // 동반인 설정 - companion 선택/입력 단계
  const [ownerCompanions, setOwnerCompanions] = useState<OwnerCompanion[]>([]);
  const [loadingOwnerCompanions, setLoadingOwnerCompanions] = useState(false);
  const [selectedCompanionId, setSelectedCompanionId] = useState<number | null>(null);
  const [newCompanionName, setNewCompanionName] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkedCompanionInfo, setLinkedCompanionInfo] = useState<LinkedCompanionInfo | null>(null);

  // 동반인 관리 (정회원용)
  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [addCompanionName, setAddCompanionName] = useState("");
  const [addingCompanion, setAddingCompanion] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => {
        if (r.status === 401) {
          setNotLoggedIn(true);
          setLoading(false);
          return null;
        }
        if (!r.ok) {
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setUser(data);
        setName(data.name || "");
        setPhoneNumber(data.phoneNumber || "");
        setLoading(false);
        if (isSetup) setShowSetup(true);
      })
      .catch(() => setLoading(false));

    fetch("/api/companions")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCompanions(data))
      .catch(() => {});
  }, [isSetup]);

  // 동반인 유형 선택 시 정회원 목록 로드
  useEffect(() => {
    if (setupMemberType === "COMPANION") {
      fetch("/api/members")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setRegularMembers(data))
        .catch(() => {});
    }
  }, [setupMemberType]);

  useEffect(() => {
    if ((user?.memberType ?? "REGULAR") !== "COMPANION") return;

    fetch("/api/members")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRegularMembers(data))
      .catch(() => {});

    fetch("/api/profile/companion-link")
      .then((r) => r.ok ? r.json() : { linked: false })
      .then((data: LinkedCompanionInfo) => {
        setLinkedCompanionInfo(data);
        if (data.linked && data.companion) {
          setSelectedOwnerKakaoId(data.companion.owner.kakaoId);
        }
      })
      .catch(() => setLinkedCompanionInfo({ linked: false }));
  }, [user?.memberType]);

  // 정회원 선택 시 해당 정회원의 동반인 목록 로드
  useEffect(() => {
    if (!selectedOwnerKakaoId) return;
    setLoadingOwnerCompanions(true);
    setSelectedCompanionId(null);
    fetch(`/api/companions/by-owner?kakaoId=${encodeURIComponent(selectedOwnerKakaoId)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setOwnerCompanions(data))
      .catch(() => setOwnerCompanions([]))
      .finally(() => setLoadingOwnerCompanions(false));
  }, [selectedOwnerKakaoId]);

  const handleSetupSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);

    // 1. 이름 + 회원유형 저장
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, memberType: setupMemberType }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUser(updated);

      // 2. 동반인 연동 처리
      if (setupMemberType === "COMPANION" && selectedOwnerKakaoId) {
        setLinking(true);
        if (selectedCompanionId) {
          // 기존 companion 연동
          await fetch("/api/companions/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companionId: selectedCompanionId }),
          });
        } else if (newCompanionName.trim()) {
          // 새 이름으로 등록
          await fetch("/api/companions/self-register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerKakaoId: selectedOwnerKakaoId, name: newCompanionName.trim() }),
          });
        }
        setLinking(false);
      }

      setShowSetup(false);
      router.replace("/profile");
    }
    setSaving(false);
  }, [name, setupMemberType, selectedOwnerKakaoId, selectedCompanionId, newCompanionName, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phoneNumber }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser(updated);

      if ((updated.memberType ?? user?.memberType) === "COMPANION" && selectedOwnerKakaoId && name.trim()) {
        const linkRes = await fetch("/api/profile/companion-link", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerKakaoId: selectedOwnerKakaoId, name: name.trim() }),
        });

        if (linkRes.ok) {
          const linked = await linkRes.json();
          setLinkedCompanionInfo(linked);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleAddCompanion() {
    if (!addCompanionName.trim()) return;
    setAddingCompanion(true);
    const res = await fetch("/api/companions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addCompanionName.trim() }),
    });
    if (res.ok) {
      const added = await res.json();
      setCompanions((prev) => [...prev, added]);
      setAddCompanionName("");
    }
    setAddingCompanion(false);
  }

  async function handleRemoveCompanion(id: number) {
    const res = await fetch("/api/companions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setCompanions((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-page)]">
      <p className="brand-text-subtle text-sm">불러오는 중...</p>
    </div>
  );

  if (notLoggedIn) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--brand-page)] px-6">
      <div className="brand-card-soft w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">🏄</div>
        <h1 className="mb-2 text-xl font-extrabold text-[var(--brand-text)]">로그인이 필요합니다</h1>
        <p className="brand-text-muted mb-6 text-sm">카카오 로그인 후 나의 프로필을 관리할 수 있습니다.</p>
        <button
          onClick={() => window.location.href = `/api/auth/kakao?returnTo=/profile`}
          className="brand-button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors"
        >
          <KakaoIcon />
          카카오로 로그인
        </button>
        <Link href="/" className="brand-text-subtle brand-link mt-4 block text-sm transition-colors">
          &larr; 홈으로 돌아가기
        </Link>
      </div>
    </div>
  );

  const isRegular = (user?.memberType ?? "REGULAR") === "REGULAR";
  const isAdmin = user?.role === "ADMIN";
  const profileDisplayName = user?.name || "이름 없음";
  const profileFallbackSeed = user?.kakaoId ?? profileDisplayName;
  const profileSaveValid = !!name.trim() && (isRegular || !!selectedOwnerKakaoId);

  // 동반인 설정 유효성: 동반인 선택 시 정회원 선택 필요, companion 선택 or 이름 입력
  const companionSetupValid = setupMemberType === "REGULAR" ||
    (!!selectedOwnerKakaoId && (!!selectedCompanionId || !!newCompanionName.trim()));

  return (
    <div className="min-h-screen bg-[var(--brand-page)] pb-12 text-[var(--brand-text)]">
      {/* 첫 로그인 설정 모달 */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4 overflow-y-auto py-8">
          <div className="brand-card-soft max-w-sm w-full rounded-2xl p-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🏄‍♂️</div>
              <h2 className="text-xl font-extrabold text-[var(--brand-text)]">환영합니다!</h2>
              <p className="brand-text-muted mt-1 text-sm">아래 정보를 입력해주세요</p>
            </div>

            <div className="space-y-5">
              {/* 이름 */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">이름(닉네임) <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="동호회에서 사용할 이름"
                  className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                  autoFocus
                />
              </div>

              {/* 회원 유형 */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--brand-text)]">
                  회원 유형 <span className="text-red-400">*</span>
                  <span className="brand-text-subtle ml-1 text-xs font-normal">(가입 후 변경 불가)</span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setSetupMemberType("REGULAR"); setSelectedOwnerKakaoId(null); }}
                    className={`brand-select-card flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
                      setupMemberType === "REGULAR" ? "brand-toggle-active" : "brand-button-secondary"
                    }`}>
                    정회원
                  </button>
                  <button type="button" onClick={() => setSetupMemberType("COMPANION")}
                    className={`brand-select-card flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
                      setupMemberType === "COMPANION" ? "brand-list-item-active" : "brand-button-secondary"
                    }`}>
                    동반인
                  </button>
                </div>
                <p className="brand-text-subtle mt-2 text-xs">
                  {setupMemberType === "REGULAR"
                    ? "직접 모임에 신청하고 동반인을 등록할 수 있습니다."
                    : "정회원에 의해 동반인으로 등록된 경우 선택하세요."}
                </p>
              </div>

              {/* 동반인 - 정회원 선택 */}
              {setupMemberType === "COMPANION" && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[var(--brand-text)]">
                      소속 정회원 선택 <span className="text-red-400">*</span>
                    </label>
                    {regularMembers.length === 0 ? (
                      <p className="brand-text-subtle py-3 text-center text-xs">등록된 정회원이 없습니다</p>
                    ) : (
                      <div className="brand-list-scroll max-h-36 space-y-1.5 overflow-y-auto rounded-xl p-2">
                        {regularMembers.map((m) => (
                          <button key={m.kakaoId} type="button"
                            onClick={() => setSelectedOwnerKakaoId(m.kakaoId)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedOwnerKakaoId === m.kakaoId
                                ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-text)] font-semibold"
                                : "text-[var(--brand-text)] hover:bg-[var(--brand-surface)]"
                            }`}>
                            {m.name || "이름 없음"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 정회원 선택 후 동반인 목록 */}
                  {selectedOwnerKakaoId && (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[var(--brand-text)]">
                        내 이름 선택 또는 직접 입력
                      </label>
                      {loadingOwnerCompanions ? (
                        <p className="brand-text-subtle py-2 text-center text-xs">불러오는 중...</p>
                      ) : (
                        <div className="space-y-1.5">
                          {ownerCompanions.filter((c) => !c.linkedKakaoId).map((c) => (
                            <button key={c.id} type="button"
                              onClick={() => { setSelectedCompanionId(selectedCompanionId === c.id ? null : c.id); setNewCompanionName(""); }}
                              className={`brand-select-card w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                                selectedCompanionId === c.id
                                  ? "brand-list-item-active font-semibold"
                                  : "text-[var(--brand-text)]"
                              }`}>
                              {c.name}
                            </button>
                          ))}
                          {/* 직접 입력 */}
                          <div className="pt-1">
                            <p className="brand-text-subtle mb-1.5 text-xs">목록에 없으면 직접 입력</p>
                            <input
                              type="text"
                              value={newCompanionName}
                              onChange={(e) => { setNewCompanionName(e.target.value); setSelectedCompanionId(null); }}
                              placeholder="내 이름 입력"
                              className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleSetupSave}
              disabled={saving || linking || !name.trim() || !companionSetupValid}
              className={`w-full mt-6 py-3 rounded-xl font-bold text-sm transition-all ${
                saving || linking || !name.trim() || !companionSetupValid
                  ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]"
                  : "brand-button-primary active:scale-[0.99]"
              }`}
            >
              {saving || linking ? "저장 중..." : "시작하기"}
            </button>
          </div>
        </div>
      )}

      <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 w-full max-w-[390px] items-center justify-between px-4">
          <Link href="/" className="flex h-12 items-center">
            <Image alt="Surfing club logo" className="h-auto w-[64px]" height={64} priority src="/logo.png" width={64} />
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Link
                className="rounded-xl bg-[var(--brand-primary-soft-strong)] px-3 py-2 text-xs font-bold text-[var(--brand-primary-text)] transition-colors hover:bg-[var(--brand-primary-soft-accent)]"
                href="/admin"
              >
                관리자
              </Link>
            ) : null}
            <button
              className="brand-button-secondary rounded-xl px-3 py-2 text-xs font-bold transition-colors"
              onClick={handleLogout}
              type="button"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[390px] flex-col gap-4 px-4 pb-28 pt-20 sm:gap-6 sm:pb-12 sm:pt-24">
        <section className="flex flex-col items-center pt-0 sm:pt-2">
          <ProfileImageUploader
            currentImage={user?.profileImage ?? null}
            fallbackSeed={profileFallbackSeed}
            onUpdated={(updatedUser) => {
              setUser((prev) => (prev ? { ...prev, ...updatedUser } : prev));
            }}
          />
          <h1 className="mt-3 text-xl font-extrabold text-[var(--brand-text)] sm:mt-4">{profileDisplayName}</h1>
          <p className="brand-text-subtle mt-1 text-xs">가입일 {user ? new Date(user.createdAt).toLocaleDateString("ko-KR") : ""}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:mt-3">
            {user?.memberType ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${MEMBER_TYPE_COLORS[user.memberType] || "brand-chip-soft"}`}>
                {MEMBER_TYPE_LABELS[user.memberType] || user.memberType}
              </span>
            ) : null}
            <span className="rounded-full bg-[var(--brand-primary-soft-strong)] px-2 py-0.5 text-xs font-bold text-[var(--brand-primary-text)]">
              모임 {user?._count?.participants ?? 0}회
            </span>
            {companions.length > 0 ? <span className="brand-chip-companion rounded-full px-2 py-0.5 text-xs font-bold">동반인 {companions.length}명</span> : null}
            {(user?.penaltyCount ?? 0) > 0 ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">패널티 {user?.penaltyCount}회</span> : null}
          </div>
        </section>

        {isRegular ? (
          <div className="brand-tab-bar">
            <div className="flex">
              <button
                className={`flex-1 border-b-2 px-2 py-3 text-base font-bold transition-colors ${
                  activeTab === "profile" ? "brand-tab-underline-active" : "brand-tab-underline-inactive"
                }`}
                onClick={() => setActiveTab("profile")}
                type="button"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[17px]">📝</span>
                  <span>기본 정보</span>
                </span>
              </button>
              <button
                className={`flex-1 border-b-2 px-2 py-3 text-base font-bold transition-colors ${
                  activeTab === "companions" ? "brand-tab-underline-active" : "brand-tab-underline-inactive"
                }`}
                onClick={() => setActiveTab("companions")}
                type="button"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[17px]">👥</span>
                  <span>동반인 관리</span>
                </span>
              </button>
            </div>
          </div>
        ) : null}

        <div className={isRegular ? "min-h-[23rem] sm:min-h-[27rem]" : ""}>
          {(!isRegular || activeTab === "profile") ? (
            <form id="profile-form" onSubmit={handleSave} className="space-y-4 sm:space-y-6">
              <div className="brand-card-soft rounded-2xl p-5 sm:p-6">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">이름(닉네임)</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="동호회에서 사용할 이름"
                      className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">연락처 <span className="brand-text-subtle font-normal">(선택)</span></label>
                    <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="010-0000-0000"
                      className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                      회원 유형
                    </label>
                    <div className="brand-input-dimmed rounded-xl px-4 py-2.5 text-sm font-semibold">
                      {MEMBER_TYPE_LABELS[user?.memberType ?? "REGULAR"] ?? "정회원"}
                    </div>
                  </div>

                  {!isRegular ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                        소속 정회원 <span className="text-red-400">*</span>
                      </label>
                      <p className="brand-text-subtle mb-2 text-xs">
                        동반인은 여기에서 소속 정회원을 다시 선택할 수 있습니다.
                      </p>
                      {regularMembers.length === 0 ? (
                        <div className="brand-panel-white rounded-xl px-4 py-3">
                          <p className="brand-text-subtle text-center text-xs">등록된 정회원이 없습니다</p>
                        </div>
                      ) : (
                        <div className="brand-list-scroll h-[12.25rem] snap-y snap-mandatory space-y-1.5 overflow-y-auto rounded-xl px-2 py-2.5 scroll-py-[10px]">
                          {regularMembers.map((member) => (
                            <button
                              key={member.kakaoId}
                              type="button"
                              onClick={() => setSelectedOwnerKakaoId(member.kakaoId)}
                              className={`flex min-h-[2.5rem] w-full snap-start items-center rounded-xl px-3 text-left text-sm leading-none transition-colors ${
                                selectedOwnerKakaoId === member.kakaoId
                                  ? "bg-[var(--brand-primary-soft-strong)] font-semibold text-[var(--brand-primary-text)]"
                                  : "brand-list-item brand-list-item-hover"
                              }`}
                            >
                              <span className="block truncate text-[var(--brand-text)]">{member.name || "이름 없음"}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {linkedCompanionInfo?.linked && linkedCompanionInfo.companion ? (
                        <p className="brand-text-subtle mt-2 text-xs">
                          현재 연결: {linkedCompanionInfo.companion.owner.name || "이름 없음"}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <button type="submit" disabled={saving}
                className={`hidden w-full rounded-xl py-3.5 text-sm font-bold transition-all sm:block ${
                  saving || !profileSaveValid ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]" : saved ? "bg-green-500 text-white" : "brand-button-primary active:scale-[0.99]"
                }`}>
                {saving ? "저장 중..." : saved ? "저장 완료!" : "프로필 저장하기"}
              </button>
            </form>
          ) : null}

          {isRegular && activeTab === "companions" ? (
            <div className="brand-card-soft rounded-2xl p-6">
              <div className="flex gap-2 mb-4 min-w-0">
                <input type="text" value={addCompanionName} onChange={(e) => setAddCompanionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCompanion(); } }}
                  placeholder="동반인 이름 입력"
                  className="brand-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm outline-none" />
                <button type="button" onClick={handleAddCompanion} disabled={addingCompanion || !addCompanionName.trim()}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    addingCompanion || !addCompanionName.trim() ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]" : "brand-button-primary active:scale-[0.99]"
                  }`}>
                  {addingCompanion ? "..." : "추가"}
                </button>
              </div>

              {companions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="brand-text-subtle text-sm">등록된 동반인이 없습니다</p>
                  <p className="brand-text-subtle mt-1 text-xs">이름을 입력하여 동반인을 추가하세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {companions.map((c) => (
                    <div key={c.id} className="brand-list-item flex items-center gap-3 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--brand-text)]">{c.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {c.linkedKakaoId && (
                            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold">카카오 연동</span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveCompanion(c.id)}
                        className="brand-text-subtle px-2 py-1 text-xs transition-colors hover:text-red-500">
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

      </main>
      {(!isRegular || activeTab === "profile") ? (
        <div className="brand-bottom-dock fixed inset-x-0 bottom-0 z-40 backdrop-blur sm:hidden">
          <div className="mx-auto w-full max-w-[390px] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
            <button
              className={`w-full rounded-xl py-3.5 text-sm font-bold transition-all ${
                saving || !profileSaveValid ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]" : saved ? "bg-green-500 text-white" : "brand-button-primary active:scale-[0.99]"
              }`}
              disabled={saving || !profileSaveValid}
              form="profile-form"
              type="submit"
            >
              {saving ? "저장 중..." : saved ? "저장 완료!" : "프로필 저장하기"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
