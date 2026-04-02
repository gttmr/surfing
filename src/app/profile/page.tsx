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
  createdAt: string;
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

  // 동반인 관련
  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [newCompanionName, setNewCompanionName] = useState("");
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
        setLoading(false);
        if (isSetup) setShowSetup(true);
      })
      .catch(() => setLoading(false));

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
    if (!newCompanionName.trim()) return;
    setAddingCompanion(true);
    const res = await fetch("/api/companions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCompanionName.trim() }),
    });
    if (res.ok) {
      const added = await res.json();
      setCompanions((prev) => [...prev, added]);
      setNewCompanionName("");
    }
    setAddingCompanion(false);
  }

  async function handleRemoveCompanion(id: number) {
    const res = await fetch("/api/companions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setCompanions((prev) => prev.filter((c) => c.id !== id));
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
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">모임 {user?._count.participants}회</span>
              {companions.length > 0 && (
                <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold">동반인 {companions.length}명</span>
              )}
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

          {/* 저장 버튼 */}
          <button
            type="submit"
            disabled={saving}
            className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all ${
              saving
                ? "bg-slate-300 cursor-not-allowed"
                : saved
                ? "bg-green-500"
                : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]"
            }`}
          >
            {saving ? "저장 중..." : saved ? "저장 완료!" : "프로필 저장하기"}
          </button>
        </form>

        {/* 동반인 관리 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-lg">👥</span> 내 동반인 관리
          </h3>

          {/* 동반인 추가 입력 */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newCompanionName}
              onChange={(e) => setNewCompanionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCompanion(); } }}
              placeholder="동반인 이름 입력"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleAddCompanion}
              disabled={addingCompanion || !newCompanionName.trim()}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all shrink-0 ${
                addingCompanion || !newCompanionName.trim()
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]"
              }`}
            >
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
                    <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">동반인</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCompanion(c.id)}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
