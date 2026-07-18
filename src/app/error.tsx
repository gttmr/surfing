"use client";

import { AsyncState } from "@/components/ui/AsyncState";
import { RouteStateShell } from "@/components/ui/MobileShell";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteStateShell>
      <AsyncState kind="error" title="화면을 불러오지 못했어요" description="잠시 후 다시 시도해 주세요." actionLabel="다시 시도" onAction={reset} />
    </RouteStateShell>
  );
}
