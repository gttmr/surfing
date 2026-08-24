"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminMemberDetailSheet } from "@/components/admin/AdminMemberDetailSheet";
import { AdminMemberListPanel } from "@/components/admin/AdminMemberListPanel";
import type { AdminMemberDraftErrors } from "@/components/admin/AdminMemberEditForm";
import { Dialog } from "@/components/ui/Dialog";
import {
  createAdminMemberDraft,
  filterAdminMembers,
  getAdminMemberErrorMessage,
  validateAdminMemberDraft,
  type AdminMemberDraft,
  type AdminMemberFilter,
} from "@/lib/admin-members";
import { parseAdminMemberDetail, readAdminMemberErrorCode, type AdminMemberDetail } from "@/lib/admin-member-response";
import type { AdminMemberListItem } from "@/lib/admin-page-data";

const INITIAL_FILTER = {
  query: "",
  role: "ALL",
  memberType: "ALL",
  status: "ALL",
} satisfies AdminMemberFilter;

const DRAFT_FIELD_IDS = {
  role: "admin-member-role",
  memberType: "admin-member-type",
  phoneNumber: "admin-member-phone",
  penaltyCount: "admin-member-penalty",
} as const satisfies Record<keyof AdminMemberDraft, string>;

function draftsMatch(detail: AdminMemberDetail, draft: AdminMemberDraft): boolean {
  return detail.role === draft.role
    && detail.memberType === draft.memberType
    && (detail.phoneNumber ?? "") === draft.phoneNumber
    && String(detail.penaltyCount) === draft.penaltyCount;
}

async function responseErrorCode(response: Response) {
  const body: unknown = await response.json().then((value: unknown) => value, () => null);
  return readAdminMemberErrorCode(body);
}

export function AdminMembersPageClient({ initialUsers }: { readonly initialUsers: AdminMemberListItem[] }) {
  const [users, setUsers] = useState<readonly AdminMemberListItem[]>(initialUsers);
  const [filter, setFilter] = useState<AdminMemberFilter>(INITIAL_FILTER);
  const [summary, setSummary] = useState<AdminMemberListItem | null>(null);
  const [detail, setDetail] = useState<AdminMemberDetail | null>(null);
  const [draft, setDraft] = useState<AdminMemberDraft | null>(null);
  const [draftErrors, setDraftErrors] = useState<AdminMemberDraftErrors>({});
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const detailRequestRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusSearchAfterCloseRef = useRef(false);

  const filteredUsers = useMemo(() => filterAdminMembers(users, filter), [filter, users]);
  const dirty = detail !== null && draft !== null && !draftsMatch(detail, draft);

  useEffect(() => {
    if (summary !== null || !focusSearchAfterCloseRef.current) return;
    focusSearchAfterCloseRef.current = false;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [summary]);

  function resetDetailState() {
    detailRequestRef.current += 1;
    setSummary(null);
    setDetail(null);
    setDraft(null);
    setDraftErrors({});
    setMode("view");
    setLoading(false);
    setDetailError(null);
    setSaveError(null);
    setDeleteError(null);
    setSavedMessage(null);
    setDeleteConfirmOpen(false);
  }

  async function loadDetail(member: AdminMemberListItem) {
    const requestId = ++detailRequestRef.current;
    setSummary(member);
    setDetail(null);
    setDraft(null);
    setMode("view");
    setLoading(true);
    setDetailError(null);
    setSaveError(null);
    setDeleteError(null);
    setSavedMessage(null);
    try {
      const response = await fetch(`/api/admin/members/${member.id}`);
      if (detailRequestRef.current !== requestId) return;
      if (!response.ok) {
        setDetailError(response.status === 404 ? "삭제되었거나 존재하지 않는 회원입니다." : "잠시 후 다시 시도해 주세요.");
        return;
      }
      const body: unknown = await response.json();
      const parsed = parseAdminMemberDetail(body);
      if (!parsed) {
        setDetailError("회원 정보 형식을 확인하지 못했습니다.");
        return;
      }
      setDetail(parsed);
      setDraft(createAdminMemberDraft(parsed));
    } catch (error) {
      setDetailError(error instanceof Error ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요." : "회원 정보를 불러오지 못했습니다.");
    } finally {
      if (detailRequestRef.current === requestId) setLoading(false);
    }
  }

  function requestClose() {
    if (saving || deleting) return;
    if (dirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    resetDetailState();
  }

  function discardDraft() {
    if (!detail) return;
    setDraft(createAdminMemberDraft(detail));
    setDraftErrors({});
    setSaveError(null);
    setMode("view");
  }

  function startEdit() {
    if (!detail) return;
    setDraft(createAdminMemberDraft(detail));
    setDraftErrors({});
    setSaveError(null);
    setSavedMessage(null);
    setMode("edit");
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !draft || saving) return;
    const validation = validateAdminMemberDraft(draft);
    if (!validation.valid) {
      setDraftErrors(validation.errors);
      setSaveError(null);
      const firstInvalidField = (["role", "memberType", "phoneNumber", "penaltyCount"] as const)
        .find((field) => validation.errors[field]);
      if (firstInvalidField) {
        window.requestAnimationFrame(() => document.getElementById(DRAFT_FIELD_IDS[firstInvalidField])?.focus());
      }
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/members/${detail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.value),
      });
      if (!response.ok) {
        setSaveError(getAdminMemberErrorMessage(response.status, await responseErrorCode(response)));
        return;
      }
      const nextDetail = { ...detail, ...validation.value };
      setDetail(nextDetail);
      setDraft(createAdminMemberDraft(nextDetail));
      setUsers((current) => current.map((member) => member.id === detail.id ? { ...member, ...validation.value } : member));
      setSummary((current) => current?.id === detail.id ? { ...current, ...validation.value } : current);
      setDraftErrors({});
      setMode("view");
      setSavedMessage("회원 정보가 저장되었습니다.");
    } catch (error) {
      setSaveError(error instanceof Error ? "네트워크 연결을 확인해 주세요. 초안은 그대로 유지됩니다." : "저장하지 못했습니다. 초안은 그대로 유지됩니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember() {
    if (!detail || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/admin/members/${detail.id}`, { method: "DELETE" });
      if (!response.ok) {
        setDeleteError(getAdminMemberErrorMessage(response.status, await responseErrorCode(response)).replace("저장", "삭제"));
        setDeleteConfirmOpen(false);
        return;
      }
      setUsers((current) => current.filter((member) => member.id !== detail.id));
      focusSearchAfterCloseRef.current = true;
      resetDetailState();
    } catch (error) {
      setDeleteError(error instanceof Error ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요." : "회원을 삭제하지 못했습니다.");
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  const adminCount = users.filter((member) => member.role === "ADMIN").length;
  const issueCount = users.filter((member) => member.role === "BANNED" || member.penaltyCount > 0).length;

  return (
    <AdminLayout dirtyNavigation={{ isDirty: dirty, isSaveInFlight: saving || deleting, onDiscard: discardDraft }}>
      <div className="space-y-4">
        <header className="space-y-3">
          <div>
            <p className="brand-text-subtle text-xs font-semibold">관리자 · 회원</p>
            <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">회원 관리</h1>
            <p className="brand-text-muted mt-1 text-sm">목록에서 회원을 찾고, 상세 확인 후 필요한 정보만 편집합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="brand-admin-stat rounded-full px-3 py-1.5">전체 {users.length}</span>
            <span className="brand-admin-stat rounded-full px-3 py-1.5">관리자 {adminCount}</span>
            {issueCount > 0 ? <span className="brand-chip-danger rounded-full px-3 py-1.5">확인 필요 {issueCount}</span> : null}
          </div>
        </header>

        <AdminMemberListPanel allMemberCount={users.length} filter={filter} members={filteredUsers} onFilterChange={setFilter} onOpenMember={loadDetail} onResetFilter={() => setFilter(INITIAL_FILTER)} searchInputRef={searchInputRef} />
      </div>

      <AdminMemberDetailSheet
        deleteConfirmOpen={deleteConfirmOpen}
        deleteError={deleteError}
        deleting={deleting}
        detail={detail}
        detailError={detailError}
        dirty={dirty}
        draft={draft}
        draftErrors={draftErrors}
        loading={loading}
        mode={mode}
        onCancelDelete={() => setDeleteConfirmOpen(false)}
        onCancelEdit={discardDraft}
        onChangeDraft={(nextDraft) => { setDraft(nextDraft); setDraftErrors({}); setSaveError(null); }}
        onClose={requestClose}
        onConfirmDelete={deleteMember}
        onDeleteRequest={() => { setDeleteError(null); setDeleteConfirmOpen(true); }}
        onEdit={startEdit}
        onRetry={() => { if (summary) void loadDetail(summary); }}
        onSave={saveMember}
        open={summary !== null}
        saveError={saveError}
        savedMessage={savedMessage}
        saving={saving}
        summary={summary}
      />

      <Dialog description="저장하지 않은 회원 정보 초안은 복구할 수 없습니다." onClose={() => setDiscardConfirmOpen(false)} open={discardConfirmOpen} title="변경 내용을 버릴까요?">
        <div className="grid grid-cols-2 gap-2">
          <button className="brand-button-secondary min-h-11 rounded-xl px-3 text-sm font-bold" onClick={() => setDiscardConfirmOpen(false)} type="button">계속 편집</button>
          <button className="brand-button-danger-solid min-h-11 rounded-xl px-3 text-sm font-bold" onClick={() => { setDiscardConfirmOpen(false); resetDetailState(); }} type="button">버리고 닫기</button>
        </div>
      </Dialog>
    </AdminLayout>
  );
}
