"use client";

import { FoodMenuEditorPanel } from "@/components/admin/FoodMenuEditorPanel";
import { ShopLayout } from "@/components/shop/ShopLayout";
import type { AdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

export function ShopMenusPageClient({
  initialData,
}: {
  initialData: AdminFoodMenuSettingsData;
}) {
  return (
    <ShopLayout>
      <div className="mb-6">
        <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">
          메뉴관리
        </h1>
      </div>

      <FoodMenuEditorPanel initialData={initialData} saveEndpoint="/api/shop/menus" />
    </ShopLayout>
  );
}
