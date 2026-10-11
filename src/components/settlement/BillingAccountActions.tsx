"use client";

import { useState } from "react";
import type { SettlementAccount } from "@/lib/landing-types";
import { buildTossTransferUrl } from "@/lib/toss";
import { formatWon } from "@/lib/format";

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
    <div className="space-y-2">
      {tossUrl ? (
        <a className="brand-button-primary flex min-h-12 w-full items-center justify-center rounded-xl px-3 text-base font-extrabold" href={tossUrl}>
          토스로 {formatWon(amount)} 보내기
        </a>
      ) : null}
      <button
        className="brand-button-secondary flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm"
        onClick={copyAccount}
        type="button"
      >
        <span className="min-w-0 truncate">
          <span className="font-bold text-brand-text">{account.bankName} {account.accountNumber}</span>
          <span className="brand-text-subtle ml-1 text-xs">{account.accountHolder}</span>
        </span>
        <span className="shrink-0 text-xs font-bold">{copied ? "복사했어요" : "계좌 복사"}</span>
      </button>
    </div>
  );
}
