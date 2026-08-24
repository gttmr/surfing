"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  AdminSettingActionBar,
  AdminSettingSaveError,
  saveFailureMessage,
} from "@/components/admin/AdminSettingControls";
import {
  AdminFoodSupportSection,
  AdminMemberFeesSection,
} from "@/components/admin/AdminPricingSections";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  MEMBER_FEE_KEYS,
  validatePricingDraft,
  type PricingInputErrors,
  type PricingInputKey,
} from "@/lib/admin-pricing-settings";
import type { AdminPricingState } from "@/lib/admin-page-data";
import {
  FOOD_ORDER_SUPPORT_CAP_KEY,
  PRICING_SETTING_KEYS,
} from "@/lib/settings";

type PricingSection = "memberFees" | "foodSupport";

export function AdminPricingPageClient({
  initialPricing,
}: {
  readonly initialPricing: AdminPricingState;
}) {
  const [snapshot, setSnapshot] = useState(initialPricing);
  const [draft, setDraft] = useState(initialPricing);
  const [editingSection, setEditingSection] = useState<PricingSection | null>(null);
  const [errors, setErrors] = useState<PricingInputErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const memberFeesDirty = MEMBER_FEE_KEYS.some((key) => snapshot[key] !== draft[key]);
  const foodSupportDirty = snapshot.foodOrderSupportCap !== draft.foodOrderSupportCap;
  const dirtySectionCount = Number(memberFeesDirty) + Number(foodSupportDirty);

  function toggleEditing(section: PricingSection) {
    if (saving) return;
    setEditingSection((current) => current === section ? null : section);
  }

  function updateValue(key: PricingInputKey, value: string) {
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
    const validation = validatePricingDraft(draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSaveError(null);
      setEditingSection(validation.firstKey === "foodOrderSupportCap" ? "foodSupport" : "memberFees");
      window.requestAnimationFrame(() => document.getElementById(`pricing-${validation.firstKey}`)?.focus());
      return;
    }

    setSaving(true);
    setSaveError(null);
    const nextSnapshot = validation.value;
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            [PRICING_SETTING_KEYS.regularBaseFee]: nextSnapshot[PRICING_SETTING_KEYS.regularBaseFee],
            [PRICING_SETTING_KEYS.companionBaseFee]: nextSnapshot[PRICING_SETTING_KEYS.companionBaseFee],
            [PRICING_SETTING_KEYS.regularLessonFee]: nextSnapshot[PRICING_SETTING_KEYS.regularLessonFee],
            [PRICING_SETTING_KEYS.companionLessonFee]: nextSnapshot[PRICING_SETTING_KEYS.companionLessonFee],
            [PRICING_SETTING_KEYS.regularRentalFee]: nextSnapshot[PRICING_SETTING_KEYS.regularRentalFee],
            [PRICING_SETTING_KEYS.companionRentalFee]: nextSnapshot[PRICING_SETTING_KEYS.companionRentalFee],
            [FOOD_ORDER_SUPPORT_CAP_KEY]: nextSnapshot.foodOrderSupportCap,
          },
        }),
      });
      if (!response.ok) {
        const message = saveFailureMessage(response.status);
        setSaveError(message);
        addToast("비용 초안을 저장하지 못했습니다", "error");
        return;
      }

      setSnapshot(nextSnapshot);
      setDraft(nextSnapshot);
      setErrors({});
      setEditingSection(null);
      addToast("비용 설정이 저장되었습니다", "success");
    } catch (error) {
      const message = error instanceof Error
        ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        : "비용 설정을 저장하지 못했습니다.";
      setSaveError(message);
      addToast("비용 초안을 저장하지 못했습니다", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout dirtyNavigation={{ isDirty: dirtySectionCount > 0, isSaveInFlight: saving, onDiscard: discardDraft }}>
      <div className="space-y-4">
        <header className="space-y-3">
          <div>
            <p className="brand-text-subtle text-xs font-semibold">관리자 · 정산 기준</p>
            <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">비용 책정</h1>
            <p className="brand-text-muted mt-1 text-sm">회원 정산에 쓰는 금액을 섹션별로 확인하고 필요한 항목만 편집합니다.</p>
          </div>
          <p aria-live="polite" className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${dirtySectionCount > 0 ? "brand-chip-preparing" : "brand-chip-success"}`}>
            {dirtySectionCount > 0 ? `${dirtySectionCount}개 섹션 변경됨` : "모든 변경사항 저장됨"}
          </p>
        </header>

        <form className="space-y-4" noValidate onSubmit={handleSave}>
          {saveError ? <AdminSettingSaveError message={saveError} /> : null}
          <AdminMemberFeesSection
            dirty={memberFeesDirty}
            disabled={saving}
            draft={draft}
            editing={editingSection === "memberFees"}
            errors={errors}
            onChange={updateValue}
            onToggleEditing={() => toggleEditing("memberFees")}
            snapshot={snapshot}
          />
          <AdminFoodSupportSection
            dirty={foodSupportDirty}
            disabled={saving}
            draft={draft}
            editing={editingSection === "foodSupport"}
            error={errors.foodOrderSupportCap}
            onChange={updateValue}
            onToggleEditing={() => toggleEditing("foodSupport")}
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
