"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminNoticeEditor, type NoticeDraft, type NoticeFieldErrors } from "@/components/admin/AdminNoticeEditor";
import { AdminNoticeList, AdminNoticeReader } from "@/components/admin/AdminNoticeViews";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminMessageSettings, AdminNoticeItem } from "@/lib/admin-page-data";
import { PARTICIPANT_OPTION_PRICING_GUIDE_KEY } from "@/lib/settings";

const EMPTY_DRAFT = { title: "", body: "", isPinned: false } as const satisfies NoticeDraft;

type NoticeMode =
  | { readonly kind: "list" }
  | { readonly kind: "reader"; readonly noticeId: number }
  | { readonly kind: "create" }
  | { readonly kind: "edit"; readonly noticeId: number };

function isNoticeItem(value: unknown): value is AdminNoticeItem {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "number"
    && "title" in value && typeof value.title === "string"
    && "body" in value && typeof value.body === "string"
    && "isPinned" in value && typeof value.isPinned === "boolean"
    && "createdAt" in value && typeof value.createdAt === "string"
    && "updatedAt" in value && typeof value.updatedAt === "string";
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const value: unknown = await response.json().catch(() => null);
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
    ? value.error
    : fallback;
}

function sortNotices(notices: readonly AdminNoticeItem[]): AdminNoticeItem[] {
  return [...notices].sort((left, right) => {
    if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function validateDraft(draft: NoticeDraft): NoticeFieldErrors {
  return {
    title: draft.title.trim() ? undefined : "공지 제목을 입력해 주세요.",
    body: draft.body.trim() ? undefined : "공지 내용을 입력해 주세요.",
  };
}

export function AdminMessagesPageClient({
  initialNotices,
  initialSettings,
}: {
  initialNotices: AdminNoticeItem[];
  initialSettings: AdminMessageSettings;
}) {
  const [notices, setNotices] = useState(() => sortNotices(initialNotices));
  const [mode, setMode] = useState<NoticeMode>({ kind: "list" });
  const [draft, setDraft] = useState<NoticeDraft>(EMPTY_DRAFT);
  const [baselineDraft, setBaselineDraft] = useState<NoticeDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<NoticeFieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [listError, setListError] = useState("");
  const [pendingMode, setPendingMode] = useState<NoticeMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminNoticeItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const selectedId = mode.kind === "reader" || mode.kind === "edit" ? mode.noticeId : null;
  const selectedNotice = selectedId === null ? null : notices.find((notice) => notice.id === selectedId) ?? null;
  const editorOpen = mode.kind === "create" || mode.kind === "edit";
  const dirty = editorOpen && (draft.title !== baselineDraft.title || draft.body !== baselineDraft.body || draft.isPinned !== baselineDraft.isPinned);
  const pinnedCount = notices.filter((notice) => notice.isPinned).length;

  function openMode(nextMode: NoticeMode) {
    setErrors({});
    setSubmitError("");
    if (nextMode.kind === "create") {
      setDraft(EMPTY_DRAFT);
      setBaselineDraft(EMPTY_DRAFT);
    }
    if (nextMode.kind === "edit") {
      const notice = notices.find((item) => item.id === nextMode.noticeId);
      if (!notice) return;
      const noticeDraft = { title: notice.title, body: notice.body, isPinned: notice.isPinned };
      setDraft(noticeDraft);
      setBaselineDraft(noticeDraft);
    }
    setMode(nextMode);
  }

  function requestMode(nextMode: NoticeMode) {
    if (dirty) {
      setPendingMode(nextMode);
      return;
    }
    openMode(nextMode);
  }

  async function handleRefresh() {
    setLoadingList(true);
    setListError("");
    try {
      const response = await fetch("/api/admin/notices");
      if (!response.ok) throw new Error(await errorMessage(response, "잠시 후 다시 시도해 주세요."));
      const value: unknown = await response.json();
      if (!Array.isArray(value) || !value.every(isNoticeItem)) throw new Error("공지 응답을 읽지 못했습니다.");
      setNotices(sortNotices(value));
    } catch (error) {
      setListError(error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setLoadingList(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.body) return;

    setSaving(true);
    setSubmitError("");
    try {
      const editingId = mode.kind === "edit" ? mode.noticeId : null;
      const response = await fetch(editingId ? `/api/admin/notices/${editingId}` : "/api/admin/notices", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, title: draft.title.trim(), body: draft.body.trim() }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "공지를 저장하지 못했습니다."));
      const value: unknown = await response.json();
      if (!isNoticeItem(value)) throw new Error("저장된 공지 응답을 읽지 못했습니다.");
      setNotices((current) => sortNotices([
        value,
        ...current.filter((notice) => notice.id !== value.id).map((notice) => value.isPinned ? { ...notice, isPinned: false } : notice),
      ]));
      setBaselineDraft({ title: value.title, body: value.body, isPinned: value.isPinned });
      setDraft({ title: value.title, body: value.body, isPinned: value.isPinned });
      setMode({ kind: "reader", noticeId: value.id });
      addToast(editingId ? "공지를 수정했습니다" : "공지를 등록했습니다", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "공지를 저장하지 못했습니다.";
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePinToggle() {
    if (!selectedNotice) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/admin/notices/${selectedNotice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selectedNotice.title, body: selectedNotice.body, isPinned: !selectedNotice.isPinned }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "고정 상태를 바꾸지 못했습니다."));
      const value: unknown = await response.json();
      if (!isNoticeItem(value)) throw new Error("변경된 공지 응답을 읽지 못했습니다.");
      setNotices((current) => sortNotices(current.map((notice) => {
        if (notice.id === value.id) return value;
        return value.isPinned ? { ...notice, isPinned: false } : notice;
      })));
      addToast(value.isPinned ? "최상단 공지로 고정했습니다" : "최상단 고정을 해제했습니다", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "고정 상태를 바꾸지 못했습니다.", "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/admin/notices/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await errorMessage(response, "공지를 삭제하지 못했습니다."));
      setNotices((current) => current.filter((notice) => notice.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMode({ kind: "list" });
      addToast("공지를 삭제했습니다", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "공지를 삭제하지 못했습니다.", "error");
    } finally {
      setWorking(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <header>
          <p className="brand-text-subtle text-xs font-semibold tracking-[0.12em]">ADMIN WORKSPACE</p>
          <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">공지 관리</h1>
          <p className="brand-text-muted mt-1 text-sm">목록에서 공지를 읽고, 필요한 경우에만 작성이나 수정 화면으로 이동합니다.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="brand-admin-stat rounded-full px-3 py-1.5">전체 {notices.length}</span>
            <span className="brand-admin-stat rounded-full px-3 py-1.5">최상단 고정 {pinnedCount}</span>
          </div>
        </header>

        {mode.kind === "list" ? <AdminNoticeList error={listError} loading={loadingList} notices={notices} onCreate={() => openMode({ kind: "create" })} onRead={(noticeId) => openMode({ kind: "reader", noticeId })} onRetry={handleRefresh} /> : null}
        {mode.kind === "reader" && selectedNotice ? <AdminNoticeReader notice={selectedNotice} onBack={() => openMode({ kind: "list" })} onDelete={() => setDeleteTarget(selectedNotice)} onEdit={() => openMode({ kind: "edit", noticeId: selectedNotice.id })} onPinToggle={handlePinToggle} working={working} /> : null}
        {editorOpen ? <AdminNoticeEditor draft={draft} errors={errors} mode={mode.kind} onCancel={() => requestMode(mode.kind === "edit" ? { kind: "reader", noticeId: mode.noticeId } : { kind: "list" })} onChange={(nextDraft) => { setDraft(nextDraft); setErrors({}); setSubmitError(""); }} onSubmit={handleSubmit} saving={saving} submitError={submitError} /> : null}

        {mode.kind === "list" ? (
          <section className="brand-admin-section overflow-hidden">
            <div className="brand-admin-section-header px-5 py-4">
              <h2 className="text-base font-bold text-[var(--brand-text)]">운영 설정 바로가기</h2>
              <p className="brand-text-subtle mt-1 text-xs">공지와 함께 자주 확인하는 문구와 비용을 관리합니다.</p>
            </div>
            <div className="grid gap-2 px-5 py-4">
              <Link className="brand-list-item brand-list-item-hover flex items-center justify-between rounded-2xl p-3" href="/admin/settings">
                <span className="min-w-0"><span className="block text-sm font-bold text-[var(--brand-text)]">취소·참가비 안내 문구</span><span className="brand-text-subtle mt-1 line-clamp-1 block text-xs">{initialSettings[PARTICIPANT_OPTION_PRICING_GUIDE_KEY] || "안내 문구를 설정하세요."}</span></span>
                <Icon className="shrink-0 text-[20px]" name="chevron_right" />
              </Link>
              <Link className="brand-list-item brand-list-item-hover flex items-center justify-between rounded-2xl p-3" href="/admin/pricing">
                <span><span className="block text-sm font-bold text-[var(--brand-text)]">비용 책정</span><span className="brand-text-subtle mt-1 block text-xs">참가비와 대여비를 관리합니다.</span></span>
                <Icon className="shrink-0 text-[20px]" name="chevron_right" />
              </Link>
            </div>
          </section>
        ) : null}
      </div>

      <Dialog description="작성 중인 내용은 저장되지 않습니다." onClose={() => setPendingMode(null)} open={pendingMode !== null} title="작성 내용을 버릴까요?">
        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" onClick={() => setPendingMode(null)} type="button">계속 작성</button>
          <button className="brand-button-danger-solid flex-1 rounded-2xl px-4 py-3 text-sm font-bold" onClick={() => { const nextMode = pendingMode; setPendingMode(null); if (nextMode) openMode(nextMode); }} type="button">내용 버리기</button>
        </div>
      </Dialog>

      <Dialog description={deleteTarget ? `“${deleteTarget.title}” 공지는 삭제 후 복구할 수 없습니다.` : undefined} onClose={() => setDeleteTarget(null)} open={deleteTarget !== null} title="공지를 삭제할까요?">
        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={working} onClick={() => setDeleteTarget(null)} type="button">취소</button>
          <button className="brand-button-danger-solid flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={working} onClick={handleDelete} type="button">{working ? "삭제 중..." : "공지 삭제"}</button>
        </div>
      </Dialog>

      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />)}
    </AdminLayout>
  );
}
