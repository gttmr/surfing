"use client";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { FoodMenuEditorPanel } from "@/components/admin/FoodMenuEditorPanel";
import type { AdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

export function AdminFoodMenuPageClient({
  initialData,
}: {
  initialData: AdminFoodMenuSettingsData;
}) {
  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">
          메뉴 카테고리 관리
        </h1>
        <p className="brand-text-muted mt-1 text-sm">카테고리를 만들고 그 안에 메뉴를 배치합니다.</p>
      </div>

      <FoodMenuEditorPanel initialData={initialData} saveEndpoint="/api/admin/menus" />
    </AdminLayout>
  );
}
