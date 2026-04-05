"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import { PARTICIPANT_OPTION_PRICING_GUIDE_KEY } from "@/lib/settings";

type NoticeItem = {
  id: number;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

type MessageSettings = {
  cancellation_penalty_message?: string;
  cancellation_penalty_days?: string;
  [PARTICIPANT_OPTION_PRICING_GUIDE_KEY]?: string;
};

const EMPTY_NOTICE = { title: "", body: "", isPinned: false };

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function AdminMessagesPage() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [settings, setSettings] = useState<MessageSettings>({});
  const [form, setForm] = useState(EMPTY_NOTICE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [noticeRes, settingsRes] = await Promise.all([
        fetch("/api/admin/notices"),
        fetch("/api/admin/settings"),
      ]);

      if (!noticeRes.ok || !settingsRes.ok) {
        throw new Error("load_failed");
      }

      const [noticeData, settingsData] = await Promise.all([
        noticeRes.json(),
        settingsRes.json(),
      ]);

      setNotices(Array.isArray(noticeData) ? noticeData : []);
      setSettings(settingsData ?? {});
    } catch {
      addToast("메시지 데이터를 불러오지 못했습니다", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pinnedNotice = useMemo(
    () => notices.find((notice) => notice.isPinned) ?? null,
    [notices]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      addToast("제목과 내용을 모두 입력해 주세요", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/admin/notices/${editingId}` : "/api/admin/notices",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "save_failed");
      }

      addToast(editingId ? "공지를 수정했습니다" : "공지를 등록했습니다", "success");
      setForm(EMPTY_NOTICE);
      setEditingId(null);
      await loadData();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "공지 저장에 실패했습니다", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(notice: NoticeItem) {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      body: notice.body,
      isPinned: notice.isPinned,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_NOTICE);
  }

  async function handleDelete(id: number) {
    if (!confirm("이 공지를 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      addToast("공지를 삭제했습니다", "success");
      if (editingId === id) {
        resetForm();
      }
      await loadData();
    } catch {
      addToast("공지 삭제에 실패했습니다", "error");
    }
  }

  async function handlePinToggle(notice: NoticeItem) {
    try {
      const res = await fetch(`/api/admin/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notice.title,
          body: notice.body,
          isPinned: !notice.isPinned,
        }),
      });
      if (!res.ok) throw new Error("pin_failed");
      addToast(!notice.isPinned ? "상단 공지로 고정했습니다" : "상단 공지를 해제했습니다", "success");
      await loadData();
    } catch {
      addToast("공지 고정 상태를 바꾸지 못했습니다", "error");
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">
            메시지 관리
          </h1>
          <p className="brand-text-muted mt-1 text-sm">
            홈 상단 공지와 운영 안내 문구를 한 화면에서 정리합니다.
          </p>
        </div>
        <div className="brand-chip-soft rounded-full px-3 py-1 text-xs font-bold">
          공지 {notices.length}개
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <section className="brand-card-soft rounded-3xl p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--brand-text)]">
                {editingId ? "공지 수정" : "새 공지 작성"}
              </h2>
              <p className="brand-text-subtle mt-1 text-xs">
                고정된 공지는 메인 페이지 상단 배너로 노출됩니다.
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="brand-button-secondary rounded-full px-3 py-1.5 text-xs font-bold"
              >
                새로 작성
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                공지 제목
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="brand-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
                placeholder="예: 이번 주 송지호 비치 모임 안내"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                공지 내용
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                rows={5}
                className="brand-input w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
                placeholder="메인 화면 공지 배너와 운영 메시지에 보여줄 내용을 입력하세요."
              />
              <p className="brand-text-subtle mt-1 text-right text-xs">{form.body.length}자</p>
            </div>

            <label className="brand-panel-white flex items-center justify-between rounded-2xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--brand-text)]">홈 상단 공지로 고정</p>
                <p className="brand-text-subtle mt-0.5 text-xs">
                  하나만 고정되며, 기존 고정 공지는 자동으로 해제됩니다.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => setForm((prev) => ({ ...prev, isPinned: e.target.checked }))}
                className="h-4 w-4 accent-[var(--brand-primary)]"
              />
            </label>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="brand-button-primary flex-1 rounded-2xl px-4 py-3 text-sm font-bold"
              >
                {saving ? "저장 중..." : editingId ? "공지 수정하기" : "공지 등록하기"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="brand-button-secondary rounded-2xl px-4 py-3 text-sm font-bold"
                >
                  취소
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <div className="brand-card-soft rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[var(--brand-text)]">현재 상단 공지</h2>
              {pinnedNotice ? (
                <span className="brand-chip-strong rounded-full px-2 py-1 text-xs font-bold">고정됨</span>
              ) : (
                <span className="brand-chip-accent rounded-full px-2 py-1 text-xs font-bold">없음</span>
              )}
            </div>
            {pinnedNotice ? (
              <div className="brand-alert-info rounded-2xl p-4">
                <p className="text-sm font-bold text-[var(--brand-primary-foreground)]">
                  {pinnedNotice.title}
                </p>
                <p className="mt-1 whitespace-pre-line text-xs text-[var(--brand-primary-foreground)] opacity-80">
                  {pinnedNotice.body}
                </p>
              </div>
            ) : (
              <div className="brand-list-item rounded-2xl px-4 py-6 text-center text-sm brand-text-subtle">
                아직 고정된 공지가 없습니다.
              </div>
            )}
          </div>

          <div className="brand-card-soft rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[var(--brand-text)]">운영 메시지 연결</h2>
            </div>
            <div className="space-y-3">
              <Link href="/admin/settings" className="brand-list-item brand-list-item-hover block rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-text)]">취소 패널티 안내</p>
                    <p className="brand-text-subtle mt-1 line-clamp-2 text-xs">
                      {settings.cancellation_penalty_message || "설정 페이지에서 취소 안내 문구를 입력하세요."}
                    </p>
                  </div>
                  <span className="brand-link shrink-0 text-xs font-bold">수정</span>
                </div>
              </Link>

              <Link href="/admin/settings" className="brand-list-item brand-list-item-hover block rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-text)]">참가 옵션 가격 안내</p>
                    <p className="brand-text-subtle mt-1 line-clamp-2 text-xs">
                      {settings[PARTICIPANT_OPTION_PRICING_GUIDE_KEY] || "설정 페이지에서 참가 옵션 안내 문구를 입력하세요."}
                    </p>
                  </div>
                  <span className="brand-link shrink-0 text-xs font-bold">수정</span>
                </div>
              </Link>

              <Link href="/admin/pricing" className="brand-list-item brand-list-item-hover block rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-text)]">비용 책정</p>
                    <p className="brand-text-subtle mt-1 text-xs">
                      정회원/동반인 참가비, 강습비, 장비 대여비를 따로 관리합니다.
                    </p>
                  </div>
                  <span className="brand-link shrink-0 text-xs font-bold">열기</span>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[var(--brand-text)]">공지 목록</h2>
          <span className="brand-text-subtle text-xs">최근 수정 순으로 표시됩니다.</span>
        </div>

        {loading ? (
          <div className="brand-card-soft rounded-3xl px-4 py-10 text-center text-sm brand-text-subtle">
            공지를 불러오는 중...
          </div>
        ) : notices.length === 0 ? (
          <div className="brand-card-soft rounded-3xl px-4 py-10 text-center text-sm brand-text-subtle">
            등록된 공지가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <div key={notice.id} className="brand-card-soft rounded-3xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {notice.isPinned ? (
                        <span className="brand-chip-strong rounded-full px-2 py-1 text-xs font-bold">상단 공지</span>
                      ) : (
                        <span className="brand-chip-accent rounded-full px-2 py-1 text-xs font-bold">일반 공지</span>
                      )}
                      <span className="brand-text-subtle text-xs">
                        수정 {formatTimestamp(notice.updatedAt)}
                      </span>
                    </div>
                    <p className="text-base font-bold text-[var(--brand-text)]">{notice.title}</p>
                    <p className="brand-text-muted mt-2 whitespace-pre-line text-sm">{notice.body}</p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => handlePinToggle(notice)}
                      className="brand-button-secondary rounded-full px-3 py-1.5 text-xs font-bold"
                    >
                      {notice.isPinned ? "고정 해제" : "상단 고정"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(notice)}
                      className="brand-button-secondary rounded-full px-3 py-1.5 text-xs font-bold"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(notice.id)}
                      className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </AdminLayout>
  );
}
