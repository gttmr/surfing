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
  REGULAR: "bg-slate-100 text-slate-600",
  COMPANION: "bg-orange-50 text-orange-600",
};

function HeaderProfileButton({ name, image }: { name: string; image: string | null }) {
  const fallbackText = (name || "U").trim().slice(0, 1) || "U";

  return (
    <div className="flex items-center">
      <span className="sr-only">프로필</span>
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--brand-primary)] bg-[#1a1c1c] shadow-sm">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" src={image} />
        ) : (
          <span className="text-sm font-extrabold text-white">{fallbackText}</span>
        )}
      </div>
    </div>
  );
}

export default function ProfilePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400 text-sm">불러오는 중...</p></div>}>
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400 text-sm">불러오는 중...</p>
    </div>
  );

  if (notLoggedIn) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm border border-slate-100">
        <div className="text-5xl mb-4">🏄</div>
        <h1 className="text-xl font-extrabold text-slate-900 mb-2">로그인이 필요합니다</h1>
        <p className="text-sm text-slate-500 mb-6">카카오 로그인 후 나의 프로필을 관리할 수 있습니다.</p>
        <button
          onClick={() => window.location.href = `/api/auth/kakao?returnTo=/profile`}
          className="brand-button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors"
        >
          <KakaoIcon />
          카카오로 로그인
        </button>
        <Link href="/" className="block mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors">
          &larr; 홈으로 돌아가기
        </Link>
      </div>
    </div>
  );

  const isRegular = (user?.memberType ?? "REGULAR") === "REGULAR";
  const isAdmin = user?.role === "ADMIN";
  const profileDisplayName = user?.name || "이름 없음";
  const profileInitial = (profileDisplayName || "U").trim().slice(0, 1) || "U";

  // 동반인 설정 유효성: 동반인 선택 시 정회원 선택 필요, companion 선택 or 이름 입력
  const companionSetupValid = setupMemberType === "REGULAR" ||
    (!!selectedOwnerKakaoId && (!!selectedCompanionId || !!newCompanionName.trim()));

  return (
    <div className="min-h-screen bg-[#f9f9f9] pb-12 text-[#1a1c1c]">
      {/* 첫 로그인 설정 모달 */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🏄‍♂️</div>
              <h2 className="text-xl font-extrabold text-slate-900">환영합니다!</h2>
              <p className="text-sm text-slate-500 mt-1">아래 정보를 입력해주세요</p>
            </div>

            <div className="space-y-5">
              {/* 이름 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">이름(닉네임) <span className="text-red-400">*</span></label>
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  회원 유형 <span className="text-red-400">*</span>
                  <span className="font-normal text-slate-400 ml-1 text-xs">(가입 후 변경 불가)</span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setSetupMemberType("REGULAR"); setSelectedOwnerKakaoId(null); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                      setupMemberType === "REGULAR" ? "border-[var(--brand-primary-border-strong)] bg-[var(--brand-primary-soft-strong)] text-[var(--brand-primary-text)]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}>
                    정회원
                  </button>
                  <button type="button" onClick={() => setSetupMemberType("COMPANION")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                      setupMemberType === "COMPANION" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}>
                    동반인
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {setupMemberType === "REGULAR"
                    ? "직접 모임에 신청하고 동반인을 등록할 수 있습니다."
                    : "정회원에 의해 동반인으로 등록된 경우 선택하세요."}
                </p>
              </div>

              {/* 동반인 - 정회원 선택 */}
              {setupMemberType === "COMPANION" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      소속 정회원 선택 <span className="text-red-400">*</span>
                    </label>
                    {regularMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">등록된 정회원이 없습니다</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2">
                        {regularMembers.map((m) => (
                          <button key={m.kakaoId} type="button"
                            onClick={() => setSelectedOwnerKakaoId(m.kakaoId)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedOwnerKakaoId === m.kakaoId
                                ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-text)] font-semibold"
                                : "hover:bg-slate-50 text-slate-700"
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
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        내 이름 선택 또는 직접 입력
                      </label>
                      {loadingOwnerCompanions ? (
                        <p className="text-xs text-slate-400 text-center py-2">불러오는 중...</p>
                      ) : (
                        <div className="space-y-1.5">
                          {ownerCompanions.filter((c) => !c.linkedKakaoId).map((c) => (
                            <button key={c.id} type="button"
                              onClick={() => { setSelectedCompanionId(selectedCompanionId === c.id ? null : c.id); setNewCompanionName(""); }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                                selectedCompanionId === c.id
                                  ? "border-orange-400 bg-orange-50 text-orange-800 font-semibold"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}>
                              {c.name}
                            </button>
                          ))}
                          {/* 직접 입력 */}
                          <div className="pt-1">
                            <p className="text-xs text-slate-400 mb-1.5">목록에 없으면 직접 입력</p>
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
                  ? "bg-slate-300 cursor-not-allowed text-white"
                  : "brand-button-primary active:scale-[0.99]"
              }`}
            >
              {saving || linking ? "저장 중..." : "시작하기"}
            </button>
          </div>
        </div>
      )}

      <header className="fixed inset-x-0 top-0 z-50 bg-white/70 shadow-[0_8px_24px_rgba(26,28,28,0.06)] backdrop-blur-xl">
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
            <HeaderProfileButton image={user?.profileImage ?? null} name={profileDisplayName} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[390px] flex-col gap-6 px-4 pb-12 pt-24">
        <section className="flex flex-col items-center pt-2">
          <ProfileImageUploader
            currentImage={user?.profileImage ?? null}
            fallbackText={profileInitial}
            onUpdated={(updatedUser) => {
              setUser((prev) => (prev ? { ...prev, ...updatedUser } : prev));
            }}
          />
          <h1 className="mt-4 text-xl font-extrabold text-slate-900">{profileDisplayName}</h1>
          <p className="mt-1 text-xs text-slate-400">가입일 {user ? new Date(user.createdAt).toLocaleDateString("ko-KR") : ""}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {user?.memberType ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${MEMBER_TYPE_COLORS[user.memberType] || "bg-slate-50 text-slate-500"}`}>
                {MEMBER_TYPE_LABELS[user.memberType] || user.memberType}
              </span>
            ) : null}
            <span className="rounded-full bg-[var(--brand-primary-soft-strong)] px-2 py-0.5 text-xs font-bold text-[var(--brand-primary-text)]">
              모임 {user?._count?.participants ?? 0}회
            </span>
            {companions.length > 0 ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-600">동반인 {companions.length}명</span> : null}
            {(user?.penaltyCount ?? 0) > 0 ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">패널티 {user?.penaltyCount}회</span> : null}
          </div>
        </section>

        {isRegular ? (
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                className={`flex-1 border-b-2 px-2 py-3 text-base font-bold transition-colors ${
                  activeTab === "profile" ? "border-[var(--brand-primary)] text-slate-900" : "border-transparent text-slate-400"
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
                  activeTab === "companions" ? "border-[var(--brand-primary)] text-slate-900" : "border-transparent text-slate-400"
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

        <div className={isRegular ? "min-h-[27rem]" : ""}>
          {(!isRegular || activeTab === "profile") ? (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">이름(닉네임)</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="동호회에서 사용할 이름"
                      className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">연락처 <span className="text-slate-400 font-normal">(선택)</span></label>
                    <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="010-0000-0000"
                      className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      회원 유형 <span className="font-normal text-slate-400 ml-1 text-xs">(변경 불가 · 관리자 문의)</span>
                    </label>
                    <div className={`px-4 py-2.5 rounded-xl border text-sm font-semibold ${
                      user?.memberType === "COMPANION" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-slate-100 text-slate-600"
                    }`}>
                      {MEMBER_TYPE_LABELS[user?.memberType ?? "REGULAR"] ?? "정회원"}
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={saving}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                  saving ? "bg-slate-300 cursor-not-allowed text-white" : saved ? "bg-green-500 text-white" : "brand-button-primary active:scale-[0.99]"
                }`}>
                {saving ? "저장 중..." : saved ? "저장 완료!" : "프로필 저장하기"}
              </button>
            </form>
          ) : null}

          {isRegular && activeTab === "companions" ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex gap-2 mb-4 min-w-0">
                <input type="text" value={addCompanionName} onChange={(e) => setAddCompanionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCompanion(); } }}
                  placeholder="동반인 이름 입력"
                  className="brand-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm outline-none" />
                <button type="button" onClick={handleAddCompanion} disabled={addingCompanion || !addCompanionName.trim()}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    addingCompanion || !addCompanionName.trim() ? "bg-slate-300 cursor-not-allowed text-white" : "brand-button-primary active:scale-[0.99]"
                  }`}>
                  {addingCompanion ? "..." : "추가"}
                </button>
              </div>

              {companions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-400">등록된 동반인이 없습니다</p>
                  <p className="text-xs text-slate-300 mt-1">이름을 입력하여 동반인을 추가하세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {companions.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                        <span className="text-orange-400 text-sm font-bold">+</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">동반인</span>
                          {c.linkedKakaoId && (
                            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold">카카오 연동</span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveCompanion(c.id)}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1">
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <button
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          onClick={handleLogout}
          type="button"
        >
          로그아웃
        </button>
      </main>
    </div>
  );
}
