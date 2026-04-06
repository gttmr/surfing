"use client";

import { useEffect, useState } from "react";

export function AdminLoginPageClient({ shouldAutoLogin }: { shouldAutoLogin: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLogging, setAutoLogging] = useState(shouldAutoLogin);

  useEffect(() => {
    if (!shouldAutoLogin) return;

    fetch("/api/admin/auto-login", { method: "POST", credentials: "include" })
      .then((res) => {
        if (res.ok) {
          window.location.replace("/admin");
        } else {
          setAutoLogging(false);
        }
      })
      .catch(() => setAutoLogging(false));
  }, [shouldAutoLogin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.replace("/admin");
      return;
    }

    const data = await res.json().catch(() => null);
    setError(data?.error || "오류가 발생했습니다");
    setLoading(false);
  }

  if (autoLogging) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--brand-page)] text-[var(--brand-text)]">
        <p className="brand-text-subtle text-sm">확인 중...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-page)] px-4 text-[var(--brand-text)]">
      <div className="w-full max-w-sm">
        <div className="brand-card-soft rounded-3xl p-8">
          <div className="mb-6 text-center">
            <div className="mb-2 text-4xl">🔐</div>
            <h1 className="font-headline text-xl font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">관리자 로그인</h1>
            <p className="brand-text-subtle mt-1 text-sm">운영 도구에 접근하려면 비밀번호를 입력하세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="관리자 비밀번호"
                className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                autoFocus
              />
              {error ? <p className="mt-1.5 text-xs text-red-500">{error}</p> : null}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="brand-button-primary w-full rounded-2xl py-3 text-sm font-bold transition-colors"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
