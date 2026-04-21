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
          메뉴 카테고리 관리
        </h1>
        <p className="brand-text-muted mt-1 text-sm">판매 카테고리를 만들고 메뉴를 정리합니다.</p>
      </div>

      <FoodMenuEditorPanel initialData={initialData} saveEndpoint="/api/shop/menus" />
    </ShopLayout>
  );
}
