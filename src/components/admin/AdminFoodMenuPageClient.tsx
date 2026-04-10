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
          메뉴관리
        </h1>
      </div>

      <FoodMenuEditorPanel initialData={initialData} saveEndpoint="/api/admin/menus" />
    </AdminLayout>
  );
}
