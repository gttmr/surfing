"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import { PARTICIPANT_OPTION_PRICING_GUIDE_KEY } from "@/lib/settings";
import type { AdminMessageSettings, AdminNoticeItem } from "@/lib/admin-page-data";

const EMPTY_NOTICE = { title: "", body: "", isPinned: false };

type NoticeFormState = typeof EMPTY_NOTICE;

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

export function AdminMessagesPageClient({
  initialNotices,
  initialSettings,
}: {
  initialNotices: AdminNoticeItem[];
  initialSettings: AdminMessageSettings;
}) {
  const [notices, setNotices] = useState(initialNotices);
  const [settings] = useState(initialSettings);
  const [form, setForm] = useState<NoticeFormState>(EMPTY_NOTICE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_NOTICE);
  }

  function handleEdit(notice: AdminNoticeItem) {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      body: notice.body,
      isPinned: notice.isPinned,
    });
  }

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

      const savedNotice = (await res.json()) as AdminNoticeItem;
      const normalizedNotice = {
        ...savedNotice,
        createdAt: new Date(savedNotice.createdAt).toISOString(),
        updatedAt: new Date(savedNotice.updatedAt).toISOString(),
      };

      setNotices((prev) => {
        const next = editingId
          ? prev.map((notice) =>
              notice.id === normalizedNotice.id ? normalizedNotice : notice
            )
          : [normalizedNotice, ...prev];

        return next
          .map((notice) =>
            normalizedNotice.isPinned && notice.id !== normalizedNotice.id
              ? { ...notice, isPinned: false }
              : notice
          )
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
      });

      addToast(editingId ? "공지를 수정했습니다" : "공지를 등록했습니다", "success");
      resetForm();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "공지 저장에 실패했습니다", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("이 공지를 삭제할까요?")) return;

    try {
      const res = await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");

      setNotices((prev) => prev.filter((notice) => notice.id !== id));
      if (editingId === id) {
        resetForm();
      }
      addToast("공지를 삭제했습니다", "success");
    } catch {
      addToast("공지 삭제에 실패했습니다", "error");
    }
  }

  async function handlePinToggle(notice: AdminNoticeItem) {
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

      const updated = (await res.json()) as AdminNoticeItem;
      const normalized = {
        ...updated,
        createdAt: new Date(updated.createdAt).toISOString(),
        updatedAt: new Date(updated.updatedAt).toISOString(),
      };

      setNotices((prev) =>
        prev
          .map((item) => {
            if (item.id === normalized.id) return normalized;
            if (normalized.isPinned) return { ...item, isPinned: false };
            return item;
          })
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          })
      );

      addToast(
        !notice.isPinned ? "상단 공지로 고정했습니다" : "상단 공지를 해제했습니다",
        "success"
      );
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
            공지는 알림센터 히스토리로 쌓이고, 고정된 공지는 목록 맨 위에 유지됩니다.
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
                등록한 공지는 알림센터에 남고, 고정된 공지는 다른 공지보다 먼저 노출됩니다.
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
                placeholder="알림센터에 남길 공지 내용을 입력하세요."
              />
              <p className="brand-text-subtle mt-1 text-right text-xs">{form.body.length}자</p>
            </div>

            <label className="brand-panel-white flex items-center justify-between rounded-2xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--brand-text)]">알림센터 최상단 고정</p>
                <p className="brand-text-subtle mt-0.5 text-xs">
                  하나만 고정되며, 읽음 여부와 관계없이 알림센터에서 가장 위에 표시됩니다.
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
          <span className="brand-text-subtle text-xs">고정 공지 우선, 이후 최근 수정 순입니다.</span>
        </div>

        {notices.length === 0 ? (
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
                        <span className="brand-chip-strong rounded-full px-2 py-1 text-xs font-bold">최상단 고정</span>
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
                      {notice.isPinned ? "고정 해제" : "최상단 고정"}
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
                      className="brand-button-danger rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
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
