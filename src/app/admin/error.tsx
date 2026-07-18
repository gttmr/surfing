"use client";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { AsyncState } from "@/components/ui/AsyncState";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminLayout><AsyncState kind="error" title="관리 정보를 불러오지 못했어요" description="관리자 메뉴는 유지됩니다. 다시 시도해 주세요." actionLabel="다시 시도" onAction={reset} /></AdminLayout>;
}
