"use client";

import { ShopLayout } from "@/components/shop/ShopLayout";
import { AsyncState } from "@/components/ui/AsyncState";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ShopLayout><AsyncState kind="error" title="샵 정보를 불러오지 못했어요" description="샵 메뉴는 유지됩니다. 다시 시도해 주세요." actionLabel="다시 시도" onAction={reset} /></ShopLayout>;
}
