// 입금 1건을 미확인 청구 대상과 맞춘다. 돈 문제이므로 "확실한 경우"만 자동 확인한다.
//  - 이름(또는 등록된 입금자명) + 금액이 정확히 일치하는 청구가 딱 1건
//  - 같은 사람의 미확인 청구가 여러 건이고 입금액이 그 합계와 정확히 일치
// 그 외에는 운영진 확인 대기로 두고 후보만 제안한다.

export type DepositCandidate = {
  readonly meetingId: number;
  readonly meetingLabel: string;
  readonly recipientKakaoId: string;
  readonly recipientName: string;
  readonly totalFee: number;
};

export type DepositMatchResult =
  | { readonly kind: "auto"; readonly targets: readonly DepositCandidate[] }
  | { readonly kind: "review"; readonly suggestions: readonly DepositCandidate[] };

const MAX_SUGGESTIONS = 5;

export function normalizeDepositorName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

export function matchDeposit(
  deposit: { readonly depositorName: string | null; readonly amount: number },
  candidates: readonly DepositCandidate[],
  aliases: ReadonlyMap<string, string>,
): DepositMatchResult {
  const name = deposit.depositorName ? normalizeDepositorName(deposit.depositorName) : null;
  const aliasKakaoId = name ? aliases.get(name) : undefined;
  const isNameMatch = (candidate: DepositCandidate) =>
    name !== null &&
    (normalizeDepositorName(candidate.recipientName) === name || aliasKakaoId === candidate.recipientKakaoId);

  const byName = candidates.filter(isNameMatch);
  const exact = byName.filter((candidate) => candidate.totalFee === deposit.amount);
  if (exact.length === 1) return { kind: "auto", targets: exact };

  if (exact.length === 0 && byName.length > 1) {
    const recipients = new Set(byName.map((candidate) => candidate.recipientKakaoId));
    const sum = byName.reduce((total, candidate) => total + candidate.totalFee, 0);
    if (recipients.size === 1 && sum === deposit.amount) return { kind: "auto", targets: byName };
  }

  const isPartialName = (candidate: DepositCandidate) => {
    if (!name || name.length < 2) return false;
    const recipient = normalizeDepositorName(candidate.recipientName);
    return recipient.length >= 2 && (recipient.includes(name) || name.includes(recipient));
  };
  const rank = (candidate: DepositCandidate) => {
    const amountMatch = candidate.totalFee === deposit.amount;
    if (isNameMatch(candidate)) return amountMatch ? 0 : 1;
    if (isPartialName(candidate)) return amountMatch ? 2 : 3;
    return amountMatch ? 4 : null;
  };

  const suggestions = candidates
    .map((candidate) => ({ candidate, rank: rank(candidate) }))
    .filter((entry): entry is { candidate: DepositCandidate; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.candidate);

  return { kind: "review", suggestions };
}
