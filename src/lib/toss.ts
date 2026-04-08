import type { SettlementAccount } from "@/lib/landing-types";

export function buildTossTransferUrl(account: SettlementAccount, amount?: number): string | null {
  const accountNumber = account.accountNumber.replace(/[^\d-]/g, "");
  if (!account.bankName || !accountNumber) return null;

  const params = new URLSearchParams({
    bank: account.bankName,
    accountNo: accountNumber,
  });
  if (amount && amount > 0) {
    params.set("amount", String(amount));
  }

  return `supertoss://send?${params.toString()}`;
}
