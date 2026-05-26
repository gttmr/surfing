"use client";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { FoodMenuEditorPanel } from "@/components/admin/FoodMenuEditorPanel";
import type { AdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

export function AdminFoodMenuPageClient({
  initialData,
}: {
  initialData: AdminFoodMenuSettingsData;
}) {
  const categoryCount = initialData.categories.length;
  const menuCount = initialData.categories.reduce((sum, category) => sum + category.menus.length, 0);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <p className="brand-text-subtle text-xs font-semibold uppercase tracking-[0.12em]">
              Admin Workspace
            </p>
            <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">
              메뉴 카테고리 관리
            </h1>
            <p className="brand-text-muted mt-1 text-sm">
              카테고리를 만들고 그 안에 메뉴를 배치합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="brand-admin-stat rounded-full px-3 py-1.5">카테고리 {categoryCount}</span>
            <span className="brand-admin-stat rounded-full px-3 py-1.5">메뉴 {menuCount}</span>
          </div>
        </div>

        <FoodMenuEditorPanel initialData={initialData} saveEndpoint="/api/admin/menus" />
      </div>
    </AdminLayout>
  );
}
