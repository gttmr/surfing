"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";
import type { DepositCandidate } from "@/lib/bank-deposit-match";
import type { BankDepositDashboard, BankDepositView } from "@/lib/bank-deposits";
import { formatRelativeTimeKo, formatWon } from "@/lib/format";

type Action = Record<string, unknown> & { action: string };

function formatDepositTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DepositHeading({ deposit }: { readonly deposit: BankDepositView }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-base font-extrabold text-brand-text">{deposit.depositorName ?? "입금자 미상"}</p>
        <p className="brand-text-subtle mt-0.5 text-xs">{formatDepositTime(deposit.depositedAt)}</p>
      </div>
      <p className="shrink-0 text-base font-extrabold text-brand-text">{deposit.amount !== null ? formatWon(deposit.amount) : "-"}</p>
    </div>
  );
}

function ReviewCard({
  deposit,
  busy,
  onAction,
}: {
  readonly deposit: BankDepositView;
  readonly busy: boolean;
  readonly onAction: (action: Action) => void;
}) {
  const [remember, setRemember] = useState(true);
  const match = (candidate: DepositCandidate) =>
    onAction({
      action: "match",
      depositId: deposit.id,
      targets: [{ meetingId: candidate.meetingId, recipientKakaoId: candidate.recipientKakaoId }],
      remember,
    });

  return (
    <li className="brand-card rounded-2xl p-4">
      <DepositHeading deposit={deposit} />
      <p className="brand-text-subtle mt-2 break-all text-[11px]">{deposit.rawText}</p>

      {deposit.suggestions.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="brand-text-muted text-xs font-bold">누구의 입금인가요?</p>
          {deposit.suggestions.map((candidate) => {
            const amountMatches = candidate.totalFee === deposit.amount;
            return (
              <button
                className="brand-list-item brand-list-item-hover flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left disabled:opacity-50"
                disabled={busy}
                key={`${candidate.meetingId}:${candidate.recipientKakaoId}`}
                onClick={() => match(candidate)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-brand-text">{candidate.recipientName}</span>
                  <span className="brand-text-subtle block truncate text-xs">{candidate.meetingLabel}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${amountMatches ? "brand-chip-success" : "brand-chip-danger"}`}>
                  청구 {formatWon(candidate.totalFee)}
                </span>
              </button>
            );
          })}
          {deposit.depositorName ? (
            <label className="brand-text-muted flex min-h-11 items-center gap-2 text-xs">
              <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
              다음부터 &lsquo;{deposit.depositorName}&rsquo; 입금은 이 회원으로 자동 확인
            </label>
          ) : null}
        </div>
      ) : (
        <p className="brand-text-muted mt-3 text-xs">맞는 미확인 청구가 없습니다. 청구 공개 후 다시 대조됩니다.</p>
      )}

      <button
        className="brand-button-secondary mt-3 min-h-11 w-full rounded-xl text-sm font-bold disabled:opacity-50"
        disabled={busy}
        onClick={() => onAction({ action: "ignore", depositId: deposit.id })}
        type="button"
      >
        모임 정산과 관계없는 입금
      </button>
    </li>
  );
}

function WebhookSetup({
  dashboard,
  endpoint,
  token,
  busy,
  onRotate,
}: {
  readonly dashboard: BankDepositDashboard;
  readonly endpoint: string;
  readonly token: string | null;
  readonly busy: boolean;
  readonly onRotate: () => void;
}) {
  return (
    <details className="brand-panel-white rounded-2xl px-4 py-3" open={!dashboard.webhookConfigured}>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-extrabold text-brand-text">
        입금 알림 연결
        <span className="brand-text-subtle text-xs font-semibold">
          {dashboard.lastReceivedAt ? `마지막 수신 ${formatRelativeTimeKo(dashboard.lastReceivedAt)}` : dashboard.webhookConfigured ? "수신 기록 없음" : "미설정"}
        </span>
      </summary>
      <ol className="brand-text-muted mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
        <li>정산 계좌 주인의 안드로이드 폰에 MacroDroid 앱을 설치합니다.</li>
        <li>트리거: 알림 수신 → 은행 앱 선택 → 내용에 &lsquo;입금&rsquo; 포함.</li>
        <li>
          동작: HTTP 요청 → POST <span className="break-all font-mono">{endpoint}</span>
        </li>
        <li>헤더: <span className="font-mono">Authorization: Bearer (아래 토큰)</span></li>
        <li>본문(form): <span className="font-mono">title</span>=알림 제목, <span className="font-mono">text</span>=알림 내용</li>
      </ol>
      {token ? (
        <div className="brand-alert-info mt-3 rounded-xl px-3 py-2 text-xs">
          <p className="font-bold">새 토큰 (이 화면을 벗어나면 다시 볼 수 없습니다)</p>
          <p className="mt-1 select-all break-all font-mono">{token}</p>
        </div>
      ) : null}
      <button
        className="brand-button-secondary mt-3 min-h-11 w-full rounded-xl text-sm font-bold disabled:opacity-50"
        disabled={busy}
        onClick={onRotate}
        type="button"
      >
        {dashboard.webhookConfigured ? "토큰 다시 발급 (기존 연결 끊김)" : "토큰 발급"}
      </button>
    </details>
  );
}

export function AdminBankDepositsPageClient({
  initialDashboard,
  webhookEndpoint,
}: {
  readonly initialDashboard: BankDepositDashboard;
  readonly webhookEndpoint: string;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const { toasts, addToast, removeToast } = useToast();

  async function run(action: Action, successMessage?: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bank-deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        addToast(body.error ?? "처리하지 못했습니다.", "error");
        return false;
      }
      setDashboard(body.dashboard);
      if (body.token) setToken(body.token);
      if (successMessage) addToast(successMessage, "success");
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    const ok = await run(
      { action: "add-manual", depositorName: manualName, amount: Number(manualAmount.replace(/[^\d]/g, "")) },
      "입금을 기록했습니다.",
    );
    if (ok) {
      setManualName("");
      setManualAmount("");
    }
  }

  const unpaidCount = dashboard.unpaidByMeeting.reduce((total, meeting) => total + meeting.recipients.length, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header>
          <p className="brand-text-subtle text-xs font-bold">DEPOSITS</p>
          <h1 className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">입금 대조</h1>
          <p className="brand-text-muted mt-1 break-keep text-sm">
            이름과 금액이 정확히 맞는 입금은 자동으로 확인됩니다. 아래에는 사람이 봐야 하는 것만 남습니다.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="brand-panel-white rounded-xl py-2">
              <p className="text-lg font-extrabold text-brand-text">{dashboard.needsReview.length}</p>
              <p className="brand-text-subtle text-[11px] font-bold">확인 필요</p>
            </div>
            <div className="brand-panel-white rounded-xl py-2">
              <p className="text-lg font-extrabold text-brand-text">{unpaidCount}</p>
              <p className="brand-text-subtle text-[11px] font-bold">미입금</p>
            </div>
            <div className="brand-panel-white rounded-xl py-2">
              <p className="text-lg font-extrabold text-brand-text">{dashboard.matched.filter((deposit) => deposit.matchedAutomatically).length}</p>
              <p className="brand-text-subtle text-[11px] font-bold">자동 확인</p>
            </div>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="px-1 text-base font-extrabold text-brand-text">확인 필요</h2>
          {dashboard.needsReview.length > 0 ? (
            <ul className="space-y-3">
              {dashboard.needsReview.map((deposit) => (
                <ReviewCard busy={busy} deposit={deposit} key={deposit.id} onAction={(action) => void run(action, "입금을 확인했습니다.")} />
              ))}
            </ul>
          ) : (
            <div className="brand-panel-white rounded-2xl px-4 py-6 text-center" role="status">
              <Icon className="text-[28px] text-brand-success" name="task_alt" />
              <p className="mt-1 text-sm font-bold text-brand-text">확인할 입금이 없습니다.</p>
            </div>
          )}
        </section>

        {dashboard.unpaidByMeeting.length > 0 ? (
          <section className="space-y-3">
            <h2 className="px-1 text-base font-extrabold text-brand-text">아직 입금 안 됨</h2>
            {dashboard.unpaidByMeeting.map((meeting) => (
              <div className="brand-card rounded-2xl" key={meeting.meetingId}>
                <p className="brand-text-subtle border-b border-brand-divider px-4 py-2 text-xs font-bold">{meeting.meetingLabel}</p>
                <ul className="divide-y divide-brand-divider">
                  {meeting.recipients.map((recipient) => (
                    <li className="flex min-h-11 items-center justify-between px-4 text-sm" key={recipient.recipientKakaoId}>
                      <span className="font-bold text-brand-text">{recipient.recipientName}</span>
                      <span className="text-brand-text">{formatWon(recipient.totalFee)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="px-1 text-base font-extrabold text-brand-text">알림이 안 온 입금 직접 기록</h2>
          <div className="brand-card flex gap-2 rounded-2xl p-3">
            <input
              aria-label="입금자명"
              className="brand-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm"
              onChange={(event) => setManualName(event.target.value)}
              placeholder="입금자명"
              value={manualName}
            />
            <input
              aria-label="금액"
              className="brand-input w-28 rounded-xl px-3 py-2 text-sm"
              inputMode="numeric"
              onChange={(event) => setManualAmount(event.target.value)}
              placeholder="금액"
              value={manualAmount}
            />
            <button
              className="brand-button-primary shrink-0 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
              disabled={busy || !manualName.trim() || !manualAmount.trim()}
              onClick={() => void addManual()}
              type="button"
            >
              기록
            </button>
          </div>
        </section>

        {dashboard.matched.length > 0 ? (
          <section className="space-y-3">
            <h2 className="px-1 text-base font-extrabold text-brand-text">확인된 입금</h2>
            <ul className="space-y-2">
              {dashboard.matched.map((deposit) => (
                <li className="brand-list-item rounded-2xl px-4 py-3" key={deposit.id}>
                  <DepositHeading deposit={deposit} />
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="min-w-0 text-xs">
                      {deposit.matches.map((match) => (
                        <p className="brand-text-muted truncate" key={`${match.meetingLabel}:${match.recipientName}`}>
                          {match.recipientName} · {match.meetingLabel}
                        </p>
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${deposit.matchedAutomatically ? "brand-chip-soft" : "brand-chip-dimmed"}`}>
                        {deposit.matchedAutomatically ? "자동" : "수동"}
                      </span>
                      <button
                        className="brand-link min-h-11 text-xs font-bold disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void run({ action: "undo", depositId: deposit.id }, "확인을 취소했습니다.")}
                        type="button"
                      >
                        되돌리기
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {dashboard.unrecognized.length > 0 ? (
          <details className="brand-panel-white rounded-2xl px-4 py-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-extrabold text-brand-text">
              정산과 무관하거나 읽지 못한 알림 {dashboard.unrecognized.length}건
            </summary>
            <ul className="mt-2 space-y-2">
              {dashboard.unrecognized.map((deposit) => (
                <li className="border-t border-brand-divider pt-2 text-xs" key={deposit.id}>
                  <p className="brand-text-subtle">{formatDepositTime(deposit.depositedAt)}</p>
                  <p className="break-all text-brand-text">{deposit.rawText}</p>
                  {deposit.status === "IGNORED" && deposit.amount !== null ? (
                    <button
                      className="brand-link mt-1 min-h-11 font-bold disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void run({ action: "restore", depositId: deposit.id })}
                      type="button"
                    >
                      확인 필요로 되돌리기
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {dashboard.aliases.length > 0 ? (
          <details className="brand-panel-white rounded-2xl px-4 py-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-extrabold text-brand-text">
              기억한 입금자명 {dashboard.aliases.length}개
            </summary>
            <ul className="mt-2 divide-y divide-brand-divider">
              {dashboard.aliases.map((alias) => (
                <li className="flex min-h-11 items-center justify-between gap-3 text-sm" key={alias.id}>
                  <span className="min-w-0 truncate text-brand-text">
                    {alias.depositorName} → <span className="font-bold">{alias.memberName}</span>
                  </span>
                  <button
                    className="brand-link shrink-0 text-xs font-bold disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void run({ action: "delete-alias", aliasId: alias.id })}
                    type="button"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <WebhookSetup busy={busy} dashboard={dashboard} endpoint={webhookEndpoint} onRotate={() => void run({ action: "rotate-token" })} token={token} />
      </div>
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />
      ))}
    </AdminLayout>
  );
}
