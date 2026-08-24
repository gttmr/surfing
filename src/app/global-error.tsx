"use client";

import { AsyncState } from "@/components/ui/AsyncState";
import { RouteStateShell } from "@/components/ui/MobileShell";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-brand-page font-sans text-brand-text">
        <RouteStateShell>
          <AsyncState kind="error" title="앱을 열지 못했어요" description="연결을 확인한 뒤 다시 시도해 주세요." actionLabel="다시 시도" onAction={reset} />
        </RouteStateShell>
      </body>
    </html>
  );
}
