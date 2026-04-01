"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface UserProfile {
  id: number;
  kakaoId: string;
  name: string | null;
  profileImage: string | null;
  phoneNumber: string | null;
  memberType: string;
  companionOfKakaoId: string | null;
  companionOf: { kakaoId: string; name: string | null } | null;
  penaltyCount: number;
  createdAt: string;
  _count: {
    participants: number;
  };
}

interface RegularMember {
  kakaoId: string;
  name: string | null;
}

interface CompanionMember {
  id: number;
  kakaoId: string;
  name: string | null;
  profileImage: string | null;
  memberType: string;
}

interface LinkableMember {
  kakaoId: string;
  name: string | null;
  profileImage: string | null;
  memberType: string;
  companionOfKakaoId: string | null;
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.477 2 10.857c0 2.713 1.584 5.1 3.988 6.577L5 21l4.29-2.287C10.145 18.9 11.058 19 12 19c5.523 0 10-3.477 10-7.143C22 6.477 17.523 3 12 3z" />
    </svg>
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

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [memberType, setMemberType] = useState("REGULAR");
  const [companionOfKakaoId, setCompanionOfKakaoId] = useState("");
  const [regularMembers, setRegularMembers] = useState<RegularMember[]>([]);
  const [companions, setCompanions] = useState<CompanionMember[]>([]);
  const [linkableMembers, setLinkableMembers] = useState<LinkableMember[]>([]);
  const [showAddCompanion, setShowAddCompanion] = useState(false);
  const [addingCompanion, setAddingCompanion] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => {
        if (r.status === 401) { setNotLoggedIn(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setUser(data);
        setName(data.name || "");
        setPhoneNumber(data.phoneNumber || "");
        setMemberType(data.memberType || "REGULAR");
        setCompanionOfKakaoId(data.companionOfKakaoId || "");
        setLoading(false);
        if (isSetup) setShowSetup(true);
      })
      .catch(() => setLoading(false));

    // 정회원 목록 로드 (동반인 선택용)
    fetch("/api/members")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRegularMembers(data))
      .catch(() => {});

    // 내 동반인 목록 로드
    fetch("/api/companions")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCompanions(data))
      .catch(() => {});
  }, [isSetup]);

  const handleSetupSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser(updated);
      setShowSetup(false);
      router.replace("/profile");
    }
    setSaving(false);
  }, [name, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phoneNumber,
        memberType,
        companionOfKakaoId: memberType === "COMPANION" ? companionOfKakaoId : null,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function openAddCompanion() {
    setShowAddCompanion(true);
    const res = await fetch("/api/members?linkable=true");
    if (res.ok) {
      const data = await res.json();
      // 이미 내 동반인인 사람은 제외
      const companionIds = new Set(companions.map((c) => c.kakaoId));
      setLinkableMembers(data.filter((m: LinkableMember) => !companionIds.has(m.kakaoId)));
    }
  }

  async function handleAddCompanion(kakaoId: string) {
    setAddingCompanion(true);
    const res = await fetch("/api/companions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kakaoId }),
    });
    if (res.ok) {
      const added = await res.json();
      setCompanions((prev) => [...prev, added]);
      setLinkableMembers((prev) => prev.filter((m) => m.kakaoId !== kakaoId));
    }
    setAddingCompanion(false);
  }

  async function handleRemoveCompanion(kakaoId: string) {
    const res = await fetch("/api/companions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kakaoId }),
    });
    if (res.ok) {
      setCompanions((prev) => prev.filter((c) => c.kakaoId !== kakaoId));
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (notLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm border border-slate-100">
          <div className="text-5xl mb-4">🏄</div>
          <h1 className="text-xl font-extrabold text-slate-900 mb-2">로그인이 필요합니다</h1>
          <p className="text-sm text-slate-500 mb-6">카카오 로그인 후 나의 프로필을 관리할 수 있습니다.</p>
          <button
            onClick={() => window.location.href = `/api/auth/kakao?returnTo=/profile`}
            className="w-full h-12 inline-flex items-center gap-2 bg-[#FEE500] hover:bg-[#f0d800] text-[#3C1E1E] font-bold rounded-xl transition-colors justify-center text-sm"
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
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* 첫 로그인 설정 모달 */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🏄‍♂️</div>
              <h2 className="text-xl font-extrabold text-slate-900">환영합니다!</h2>
              <p className="text-sm text-slate-500 mt-1">이름을 입력해주세요</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">이름(닉네임) <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="동호회에서 사용할 이름"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <button
              onClick={handleSetupSave}
              disabled={saving || !name.trim()}
              className={`w-full mt-6 py-3 rounded-xl font-bold text-white text-sm transition-all ${
                saving || !name.trim()
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]"
              }`}
            >
              {saving ? "저장 중..." : "시작하기"}
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
        <div className="max-w-lg mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-blue-200 hover:text-white transition-colors text-xl leading-none">&larr;</Link>
            <h1 className="font-bold text-lg">내 프로필</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-blue-200 hover:text-white text-sm transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
            {user?.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl text-slate-300">👤</span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">{user?.name || "이름 없음"}</h2>
            <p className="text-xs text-slate-400 mt-1">
              가입일: {user ? new Date(user.createdAt).toLocaleDateString("ko-KR") : ""}
            </p>
            <div className="flex gap-3 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                user?.memberType === "COMPANION" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
              }`}>
                {user?.memberType === "COMPANION" ? "동반인" : "정회원"}
              </span>
              {user?.memberType === "COMPANION" && user?.companionOf?.name && (
                <span className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full">
                  {user.companionOf.name}의 동반
                </span>
              )}
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">모임 {user?._count.participants}회</span>
              {(user?.penaltyCount ?? 0) > 0 && (
                <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">패널티 {user?.penaltyCount}회</span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* 기본 정보 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-lg">📝</span> 기본 정보
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">이름(닉네임)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="동호회에서 사용할 이름"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">연락처 <span className="text-slate-400 font-normal">(선택)</span></label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* 회원 유형 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-lg">🏄</span> 회원 유형
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setMemberType("REGULAR"); setCompanionOfKakaoId(""); }}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                    memberType === "REGULAR"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                >
                  정회원
                </button>
                <button
                  type="button"
                  onClick={() => setMemberType("COMPANION")}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                    memberType === "COMPANION"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                >
                  동반인
                </button>
              </div>

              {memberType === "COMPANION" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    정회원 선택 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={companionOfKakaoId}
                    onChange={(e) => setCompanionOfKakaoId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-orange-500 transition-colors"
                  >
                    <option value="">정회원을 선택해주세요</option>
                    {regularMembers.map((m) => (
                      <option key={m.kakaoId} value={m.kakaoId}>
                        {m.name || "(이름 없음)"}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-400">
                    본인을 초대한 정회원을 선택해주세요. 모임 목록에서 해당 정회원 아래에 표시됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 저장 버튼 */}
          <button
            type="submit"
            disabled={saving || (memberType === "COMPANION" && !companionOfKakaoId)}
            className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all ${
              saving || (memberType === "COMPANION" && !companionOfKakaoId)
                ? "bg-slate-300 cursor-not-allowed"
                : saved
                ? "bg-green-500"
                : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]"
            }`}
          >
            {saving ? "저장 중..." : saved ? "저장 완료!" : "프로필 저장하기"}
          </button>
        </form>

        {/* 동반인 관리 (정회원만 표시) */}
        {memberType === "REGULAR" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span className="text-lg">👥</span> 내 동반인 관리
              </h3>
              <button
                type="button"
                onClick={openAddCompanion}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                + 추가
              </button>
            </div>

            {companions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400">등록된 동반인이 없습니다</p>
                <p className="text-xs text-slate-300 mt-1">동반인을 추가하면 모임 참석 시 함께 표시됩니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {companions.map((c) => (
                  <div key={c.kakaoId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {c.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.profileImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-400 text-sm">👤</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.name || "이름 없음"}</p>
                      <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">동반인</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCompanion(c.kakaoId)}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1"
                    >
                      해제
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 동반인 추가 모달 */}
            {showAddCompanion && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-sm w-full p-6 shadow-xl max-h-[70vh] flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-extrabold text-slate-900">동반인 추가</h3>
                    <button
                      onClick={() => setShowAddCompanion(false)}
                      className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                    >
                      &times;
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    가입된 회원 중 동반인으로 추가할 회원을 선택하세요.
                  </p>
                  <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-2">
                    {linkableMembers.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-8">추가 가능한 회원이 없습니다</p>
                    ) : (
                      linkableMembers.map((m) => (
                        <button
                          key={m.kakaoId}
                          disabled={addingCompanion}
                          onClick={() => handleAddCompanion(m.kakaoId)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                        >
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                            {m.profileImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.profileImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-slate-400 text-sm">👤</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{m.name || "이름 없음"}</p>
                          </div>
                          <span className="text-xs text-blue-600 font-bold shrink-0">추가</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
