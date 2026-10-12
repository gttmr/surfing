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
  const [kakaoGuide, setKakaoGuide] = useState(false);
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

  // 카카오페이는 계좌·금액을 채운 송금 링크를 공식 제공하지 않는다(2026-10 확인).
  // 계좌번호를 복사한 뒤 카카오페이 홈을 열고, 송금 → 계좌로 붙여넣도록 안내한다.
  // kakaotalk://kakaopay/home 은 비공식 경로라 동작하지 않으면 안내 문구만 남는다.
  async function openKakaoPay() {
    try {
      await navigator.clipboard.writeText(`${account.bankName} ${account.accountNumber}`);
    } catch {
      // 복사 실패 시에도 안내와 계좌 표시는 그대로 둔다.
    }
    setKakaoGuide(true);
    window.location.href = "kakaotalk://kakaopay/home";
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
        className="brand-button-secondary flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-bold"
        onClick={() => void openKakaoPay()}
        type="button"
      >
        카카오페이로 보내기
      </button>
      {kakaoGuide ? (
        <p className="brand-alert-info rounded-xl px-3 py-2 text-xs leading-5" role="status">
          계좌번호를 복사했어요. 카카오페이에서 송금 → 계좌번호로 보내기에 붙여넣고 {formatWon(amount)}을 입력해 주세요.
        </p>
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
