"use client";

import { useState } from "react";
import type { SettlementAccount } from "@/lib/landing-types";
import { buildTossTransferUrl } from "@/lib/toss";

export function BillingAccountActions({
  account,
  amount,
}: {
  readonly account: SettlementAccount;
  readonly amount: number;
}) {
  const [copied, setCopied] = useState(false);
  const tossUrl = buildTossTransferUrl(account, amount);

  async function copyAccount() {
    if (!account.accountNumber) return;
    try {
      await navigator.clipboard.writeText(account.accountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (!account.accountNumber) {
    return (
      <p className="brand-alert-info rounded-xl px-3 py-2 text-xs font-semibold" role="status">
        입금 계좌가 등록되지 않았습니다. 운영진에게 확인해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="brand-text-subtle">입금 계좌</dt>
        <dd className="font-bold text-brand-text">{account.bankName} {account.accountNumber}</dd>
        <dt className="brand-text-subtle">예금주</dt>
        <dd className="font-semibold text-brand-text">{account.accountHolder || "확인 필요"}</dd>
      </dl>
      <div className={`grid gap-2 ${tossUrl ? "grid-cols-2" : "grid-cols-1"}`}>
        {tossUrl ? (
          <a className="brand-button-primary flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-bold" href={tossUrl}>
            입금하기
          </a>
        ) : null}
        <button className="brand-button-secondary min-h-11 rounded-xl px-3 text-sm font-bold" onClick={copyAccount} type="button">
          {copied ? "복사했어요" : "계좌번호 복사"}
        </button>
      </div>
    </div>
  );
}
