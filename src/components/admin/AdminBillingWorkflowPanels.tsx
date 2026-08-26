"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { AdminSettlementData, AdminSettlementRecipient } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";

export function AdminBillingReadinessPanel({
  data,
  working,
  onToggleReview,
}: {
  readonly data: AdminSettlementData;
  readonly working: boolean;
  readonly onToggleReview: (reviewed: boolean) => void;
}) {
  const review = data.readiness.checks.find((check) => check.id === "billing-reviewed");
  const operationalChecks = data.readiness.checks.filter((check) => check.id !== "billing-reviewed");
  const operationalReady = operationalChecks.every((check) => check.complete);

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-brand-text">청구 공개 준비</h2>
            <p className="brand-text-muted mt-1 text-xs">실제 참석·이용·주문 처리가 끝나야 금액을 확정할 수 있습니다.</p>
          </div>
          <span className={`${data.readiness.ready ? "brand-chip-success" : "brand-chip-soft"} shrink-0 rounded-full px-2.5 py-1 text-xs font-bold`}>
            {data.readiness.checks.filter((check) => check.complete).length}/{data.readiness.checks.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-brand-divider px-4">
        {operationalChecks.map((check) => (
          <div className="flex min-h-14 items-center gap-3 py-2" key={check.id}>
            <Icon className={check.complete ? "text-brand-success" : "text-brand-text-subtle"} name={check.complete ? "check_circle" : "radio_button_unchecked"} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-brand-text">{check.label}</p>
              <p className="brand-text-subtle mt-0.5 break-keep text-xs">{check.detail}</p>
            </div>
            {!check.complete && check.href ? <Link className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-xs font-extrabold text-brand-primary" href={check.href}>확인</Link> : null}
          </div>
        ))}
      </div>
      <div className="border-t border-brand-divider px-4 py-4">
        <div className="mb-3 flex items-center gap-3">
          <Icon className={review?.complete ? "text-brand-success" : "text-brand-text-subtle"} name={review?.complete ? "check_circle" : "radio_button_unchecked"} />
          <div>
            <p className="text-sm font-bold text-brand-text">회원별 청구 금액 검토</p>
            <p className="brand-text-subtle mt-0.5 text-xs">아래 청구 항목과 조정 금액을 확인합니다.</p>
          </div>
        </div>
        <button
          className={`${review?.complete ? "brand-button-secondary" : "brand-button-primary"} min-h-11 w-full rounded-xl px-4 text-sm font-extrabold disabled:opacity-50`}
          disabled={working || (!operationalReady && !review?.complete)}
          onClick={() => onToggleReview(Boolean(review?.complete))}
          type="button"
        >
          {working ? "처리 중" : review?.complete ? "검토 완료 취소" : "청구 금액 검토 완료"}
        </button>
        {!operationalReady && !review?.complete ? <p className="brand-text-subtle mt-2 text-center text-xs">위 운영 확인을 먼저 완료해 주세요.</p> : null}
      </div>
    </section>
  );
}

function statusMeta(recipient: AdminSettlementRecipient) {
  if (recipient.totalFee === 0) return { label: "납부 없음", className: "brand-chip-success", icon: "remove_circle" };
  if (recipient.verified) return { label: "입금 완료", className: "brand-chip-success", icon: "check_circle" };
  if (recipient.reported) return { label: "확인 중", className: "brand-chip-soft", icon: "hourglass_top" };
  return { label: "입금 필요", className: "brand-chip-danger", icon: "account_balance_wallet" };
}

function PaymentRecipientRow({
  recipient,
  working,
  onVerify,
}: {
  readonly recipient: AdminSettlementRecipient;
  readonly working: boolean;
  readonly onVerify: (recipient: AdminSettlementRecipient, verified: boolean) => void;
}) {
  const status = statusMeta(recipient);
  return (
    <details className="brand-panel-white overflow-hidden rounded-2xl">
      <summary className="brand-touch-target flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <Icon className={recipient.verified ? "text-brand-success" : "text-brand-primary"} name={status.icon} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-brand-text">{recipient.recipientName}</span>
          <span className="brand-text-subtle mt-0.5 block text-xs">{recipient.items.length}명 참가분</span>
        </span>
        <span className="text-right">
          <span className="block text-sm font-extrabold text-brand-text">{formatWon(recipient.totalFee)}</span>
          <span className={`${status.className} mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold`}>{status.label}</span>
        </span>
        <Icon className="brand-text-subtle" name="expand_more" />
      </summary>
      <div className="border-t border-brand-divider px-4 py-4">
        <div className="space-y-2">
          {recipient.items.map((item) => (
            <div className="flex items-start justify-between gap-3 text-sm" key={item.participantId}>
              <div className="min-w-0">
                <p className="font-bold text-brand-text">{item.participantName}</p>
                <p className="brand-text-subtle mt-0.5 text-xs">참가비·실제 이용·식음료·조정 반영</p>
              </div>
              <span className="shrink-0 font-extrabold text-brand-text">{formatWon(item.totalFee)}</span>
            </div>
          ))}
        </div>
        {recipient.reportedAt ? <p className="brand-text-subtle mt-3 text-xs">회원 입금 알림 {new Date(recipient.reportedAt).toLocaleString("ko-KR")}</p> : null}
        {recipient.verifiedAt ? <p className="brand-text-subtle mt-1 text-xs">관리자 확인 {new Date(recipient.verifiedAt).toLocaleString("ko-KR")}</p> : null}
        {recipient.totalFee > 0 ? <button
          className={`${recipient.verified ? "brand-button-secondary" : "brand-button-primary"} mt-4 min-h-11 w-full rounded-xl px-4 text-sm font-extrabold disabled:opacity-50`}
          disabled={working}
          onClick={() => onVerify(recipient, recipient.verified)}
          type="button"
        >
          {working ? "처리 중" : recipient.verified ? "입금 확인 취소" : "계좌 입금 확인"}
        </button> : <p className="brand-text-subtle mt-4 rounded-xl bg-brand-dimmed-surface px-3 py-3 text-center text-xs font-semibold">회원 부담 0원 · 입금 확인이 필요하지 않습니다.</p>}
      </div>
    </details>
  );
}

export function AdminPaymentStatusPanel({
  data,
  workingRecipient,
  onVerify,
}: {
  readonly data: AdminSettlementData;
  readonly workingRecipient: string | null;
  readonly onVerify: (recipient: AdminSettlementRecipient, verified: boolean) => void;
}) {
  const groups = [
    { id: "required", title: "입금 필요", recipients: data.recipients.filter((recipient) => recipient.totalFee > 0 && !recipient.reported && !recipient.verified) },
    { id: "reported", title: "확인 중", recipients: data.recipients.filter((recipient) => recipient.totalFee > 0 && recipient.reported && !recipient.verified) },
    { id: "verified", title: "입금 완료", recipients: data.recipients.filter((recipient) => recipient.totalFee > 0 && recipient.verified) },
    { id: "not-required", title: "납부 없음", recipients: data.recipients.filter((recipient) => recipient.totalFee === 0) },
  ] as const;

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-extrabold text-brand-text">회원 입금 현황</h2>
          <p className="brand-text-muted mt-1 text-xs">회원의 입금 알림과 실제 계좌 입금을 구분합니다.</p>
        </div>
        <span className="brand-chip-soft shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{data.verifiedRecipientCount}/{data.recipients.length} 완료</span>
      </div>
      {data.recipients.length === 0 ? (
        <div className="brand-panel-white rounded-2xl px-4 py-8 text-center text-sm font-semibold text-brand-text">확인할 회원 청구가 없습니다.</div>
      ) : groups.map((group) => group.recipients.length > 0 ? (
        <div className="space-y-2" key={group.id}>
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-extrabold text-brand-text">{group.title}</h3>
            <span className="brand-text-subtle text-xs">{group.recipients.length}명</span>
          </div>
          {group.recipients.map((recipient) => (
            <PaymentRecipientRow
              key={`${recipient.recipientKakaoId}-${recipient.recipientType}`}
              onVerify={onVerify}
              recipient={recipient}
              working={workingRecipient === recipient.recipientKakaoId}
            />
          ))}
        </div>
      ) : null)}
    </section>
  );
}

function PayoutRow({
  amount,
  draft,
  label,
  paidAmount,
  paidAt,
  working,
  onChange,
  onRecord,
}: {
  readonly amount: number;
  readonly draft: string;
  readonly label: string;
  readonly paidAmount: number | null;
  readonly paidAt: string | null;
  readonly working: boolean;
  readonly onChange: (value: string) => void;
  readonly onRecord: () => void;
}) {
  if (amount === 0) {
    return (
      <div className="flex min-h-14 items-center justify-between gap-3 py-2">
        <div><p className="text-sm font-bold text-brand-text">{label}</p><p className="brand-text-subtle mt-0.5 text-xs">지급할 금액 없음</p></div>
        <Icon className="text-brand-success" name="check_circle" />
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-bold text-brand-text">{label}</p><p className="brand-text-subtle mt-0.5 text-xs">예정 {formatWon(amount)}</p></div>
        <span className={`${paidAt ? "brand-chip-success" : "brand-chip-soft"} rounded-full px-2 py-1 text-xs font-bold`}>{paidAt ? "지급 기록됨" : "지급 필요"}</span>
      </div>
      {paidAt ? (
        <p className="mt-3 text-sm font-extrabold text-brand-text">실제 {formatWon(paidAmount ?? 0)} <span className="brand-text-subtle ml-1 text-xs font-normal">{new Date(paidAt).toLocaleDateString("ko-KR")}</span></p>
      ) : (
        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{label} 실제 지급액</span>
            <input className="brand-input h-11 w-full rounded-xl px-3 text-base" inputMode="numeric" onChange={(event) => onChange(event.target.value)} pattern="[0-9]*" value={draft} />
          </label>
          <button className="brand-button-primary min-h-11 shrink-0 rounded-xl px-4 text-xs font-extrabold disabled:opacity-50" disabled={working} onClick={onRecord} type="button">{working ? "기록 중" : "지급 기록"}</button>
        </div>
      )}
    </div>
  );
}

export function AdminFinalSettlementPanel({
  data,
  shopDraft,
  foodDraft,
  working,
  onShopDraft,
  onFoodDraft,
  onRecordShop,
  onRecordFood,
  onRequestComplete,
}: {
  readonly data: AdminSettlementData;
  readonly shopDraft: string;
  readonly foodDraft: string;
  readonly working: string | null;
  readonly onShopDraft: (value: string) => void;
  readonly onFoodDraft: (value: string) => void;
  readonly onRecordShop: () => void;
  readonly onRecordFood: () => void;
  readonly onRequestComplete: () => void;
}) {
  const paymentsComplete = data.verifiedRecipientCount >= data.recipients.length;
  const shopComplete = data.billing.totals.shopPayableTotal === 0 || Boolean(data.billing.shopPayout.paidAt);
  const foodComplete = data.billing.totals.foodPayableTotal === 0 || Boolean(data.billing.foodPayout.paidAt);
  const canComplete = paymentsComplete && shopComplete && foodComplete;

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-brand-text">최종 정산</h2>
            <p className="brand-text-muted mt-1 text-xs">회원 입금과 외부 지급이 모두 끝난 뒤 모임 장부를 닫습니다.</p>
          </div>
          <span className={`${data.billing.settlementCompletedAt ? "brand-chip-success" : "brand-chip-soft"} shrink-0 rounded-full px-2.5 py-1 text-xs font-bold`}>{data.billing.settlementCompletedAt ? "완료" : "진행 중"}</span>
        </div>
      </div>
      <div className="divide-y divide-brand-divider px-4">
        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
          <div><p className="text-sm font-bold text-brand-text">회원 입금</p><p className="brand-text-subtle mt-0.5 text-xs">{data.verifiedRecipientCount}/{data.recipients.length}명 확인</p></div>
          <Icon className={paymentsComplete ? "text-brand-success" : "text-brand-text-subtle"} name={paymentsComplete ? "check_circle" : "radio_button_unchecked"} />
        </div>
        <PayoutRow amount={data.billing.totals.shopPayableTotal} draft={shopDraft} label="샵 지급" paidAmount={data.billing.shopPayout.amount} paidAt={data.billing.shopPayout.paidAt} working={working === "shop"} onChange={onShopDraft} onRecord={onRecordShop} />
        <PayoutRow amount={data.billing.totals.foodPayableTotal} draft={foodDraft} label="식음료 지급" paidAmount={data.billing.foodPayout.amount} paidAt={data.billing.foodPayout.paidAt} working={working === "food"} onChange={onFoodDraft} onRecord={onRecordFood} />
      </div>
      <div className="border-t border-brand-divider px-4 py-4">
        {data.billing.settlementCompletedAt ? (
          <div className="rounded-xl bg-brand-success-surface px-4 py-3">
            <p className="text-sm font-extrabold text-brand-success-text">최종 정산이 완료되었습니다.</p>
            <p className="mt-1 text-xs text-brand-success-text">{new Date(data.billing.settlementCompletedAt).toLocaleString("ko-KR")}</p>
            {data.billing.settlementNote ? <p className="mt-2 text-sm text-brand-text">{data.billing.settlementNote}</p> : null}
          </div>
        ) : (
          <>
            <button className="brand-button-primary min-h-11 w-full rounded-xl px-4 text-sm font-extrabold disabled:opacity-50" disabled={!canComplete || Boolean(working)} onClick={onRequestComplete} type="button">최종 정산 완료</button>
            {!canComplete ? <p className="brand-text-subtle mt-2 text-center text-xs">입금 확인과 실제 지급 기록을 모두 완료해 주세요.</p> : null}
          </>
        )}
      </div>
    </section>
  );
}
