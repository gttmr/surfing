"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  AdminSettingActionBar,
  AdminSettingSaveError,
  saveFailureMessage,
} from "@/components/admin/AdminSettingControls";
import {
  AdminCancellationPolicySection,
  AdminParticipantGuideSection,
} from "@/components/admin/AdminPolicySettingsSections";
import { AdminSettlementAccountSection } from "@/components/admin/AdminSettlementAccountSection";
import { Toast, useToast } from "@/components/ui/Toast";
import { validateSettingsDraft, type SettingsInputErrors } from "@/lib/admin-pricing-settings";
import type { AdminSettingsFormData } from "@/lib/admin-page-data";
import {
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
  SETTLEMENT_ACCOUNT_HOLDER_KEY,
  SETTLEMENT_ACCOUNT_NUMBER_KEY,
  SETTLEMENT_BANK_NAME_KEY,
} from "@/lib/settings";

type SettingsSection = "cancellation" | "participantGuide" | "settlementAccount";

export function AdminSettingsPageClient({
  initialSettings,
}: {
  readonly initialSettings: AdminSettingsFormData;
}) {
  const [snapshot, setSnapshot] = useState(initialSettings);
  const [draft, setDraft] = useState(initialSettings);
  const [editingSection, setEditingSection] = useState<SettingsSection | null>(null);
  const [errors, setErrors] = useState<SettingsInputErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const cancellationDirty = snapshot.penaltyDays !== draft.penaltyDays
    || snapshot.penaltyMessage !== draft.penaltyMessage;
  const participantGuideDirty = snapshot.participantOptionPricingGuide !== draft.participantOptionPricingGuide;
  const settlementAccountDirty = snapshot.settlementBankName !== draft.settlementBankName
    || snapshot.settlementAccountNumber !== draft.settlementAccountNumber
    || snapshot.settlementAccountHolder !== draft.settlementAccountHolder;
  const dirtySectionCount = Number(cancellationDirty)
    + Number(participantGuideDirty)
    + Number(settlementAccountDirty);

  function toggleEditing(section: SettingsSection) {
    if (saving) return;
    setEditingSection((current) => current === section ? null : section);
  }

  function updateValue(key: keyof AdminSettingsFormData, value: string) {
    if (saving) return;
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors({});
    setSaveError(null);
  }

  function discardDraft() {
    if (saving) return;
    setDraft(snapshot);
    setErrors({});
    setSaveError(null);
    setEditingSection(null);
    addToast("저장하지 않은 변경을 취소했습니다", "info");
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const validation = validateSettingsDraft(draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSaveError(null);
      const firstSection: SettingsSection = validation.firstKey === "penaltyDays" || validation.firstKey === "penaltyMessage"
        ? "cancellation"
        : validation.firstKey === "participantOptionPricingGuide"
          ? "participantGuide"
          : "settlementAccount";
      setEditingSection(firstSection);
      window.requestAnimationFrame(() => document.getElementById(`settings-${validation.firstKey}`)?.focus());
      return;
    }

    const nextSnapshot = validation.value;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            cancellation_penalty_message: nextSnapshot.penaltyMessage,
            cancellation_penalty_days: nextSnapshot.penaltyDays,
            [PARTICIPANT_OPTION_PRICING_GUIDE_KEY]: nextSnapshot.participantOptionPricingGuide,
            [SETTLEMENT_BANK_NAME_KEY]: nextSnapshot.settlementBankName,
            [SETTLEMENT_ACCOUNT_NUMBER_KEY]: nextSnapshot.settlementAccountNumber,
            [SETTLEMENT_ACCOUNT_HOLDER_KEY]: nextSnapshot.settlementAccountHolder,
          },
        }),
      });
      if (!response.ok) {
        const message = saveFailureMessage(response.status);
        setSaveError(message);
        addToast("설정 초안을 저장하지 못했습니다", "error");
        return;
      }

      setSnapshot(nextSnapshot);
      setDraft(nextSnapshot);
      setErrors({});
      setEditingSection(null);
      addToast("설정이 저장되었습니다", "success");
    } catch (error) {
      const message = error instanceof Error
        ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        : "설정을 저장하지 못했습니다.";
      setSaveError(message);
      addToast("설정 초안을 저장하지 못했습니다", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout dirtyNavigation={{ isDirty: dirtySectionCount > 0, onDiscard: discardDraft }}>
      <div className="space-y-4">
        <header className="space-y-3">
          <div>
            <p className="brand-text-subtle text-xs font-semibold">관리자 · 회원 안내</p>
            <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">설정</h1>
            <p className="brand-text-muted mt-1 text-sm">회원에게 보이는 안내와 정산 계좌를 역할별로 확인하고 편집합니다.</p>
          </div>
          <p aria-live="polite" className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${dirtySectionCount > 0 ? "brand-chip-preparing" : "brand-chip-success"}`}>
            {dirtySectionCount > 0 ? `${dirtySectionCount}개 섹션 변경됨` : "모든 변경사항 저장됨"}
          </p>
        </header>

        <form className="space-y-4" noValidate onSubmit={handleSave}>
          {saveError ? <AdminSettingSaveError message={saveError} /> : null}
          <AdminCancellationPolicySection
            dirty={cancellationDirty}
            disabled={saving}
            draft={draft}
            editing={editingSection === "cancellation"}
            errors={errors}
            onChange={updateValue}
            onToggleEditing={() => toggleEditing("cancellation")}
            snapshot={snapshot}
          />
          <AdminParticipantGuideSection
            dirty={participantGuideDirty}
            disabled={saving}
            draft={draft}
            editing={editingSection === "participantGuide"}
            errors={errors}
            onChange={updateValue}
            onToggleEditing={() => toggleEditing("participantGuide")}
            snapshot={snapshot}
          />
          <AdminSettlementAccountSection
            dirty={settlementAccountDirty}
            disabled={saving}
            draft={draft}
            editing={editingSection === "settlementAccount"}
            errors={errors}
            onChange={updateValue}
            onToggleEditing={() => toggleEditing("settlementAccount")}
            snapshot={snapshot}
          />
          <AdminSettingActionBar dirtySectionCount={dirtySectionCount} onDiscard={discardDraft} saving={saving} />
        </form>
      </div>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />
      ))}
    </AdminLayout>
  );
}
