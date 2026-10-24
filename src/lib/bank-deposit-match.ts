// 입금 1건을 미확인 청구 대상과 맞춘다. 돈 문제이므로 "확실한 경우"만 자동 확인한다.
//  - 이름(또는 등록된 입금자명) + 남은 금액이 정확히 일치하는 청구가 딱 1건
//  - 같은 사람의 미확인 청구가 여러 건이고 입금액이 남은 금액 합계와 정확히 일치
//  - 청구에 묶인 참가자(동반인 등)가 자기 이름으로 자기 몫만 정확히 보낸 경우: 그 청구의 일부 입금으로 기록
// 그 외에는 운영진 확인 대기로 두고 후보만 제안한다.

export type DepositCandidatePart = {
  readonly participantId: number;
  readonly name: string;
  readonly amount: number;
  /** 이 사람 몫이 이미 따로 입금됐는지 */
  readonly paid: boolean;
};

export type DepositCandidate = {
  readonly meetingId: number;
  readonly meetingLabel: string;
  readonly recipientKakaoId: string;
  readonly recipientName: string;
  readonly totalFee: number;
  /** 이 청구에 이미 들어온 금액 (일부 입금) */
  readonly paidAmount: number;
  /** 청구에 묶인 참가자별 몫. 정회원 본인과 동반인이 각자 보내는 경우를 맞추는 데 쓴다. */
  readonly parts: readonly DepositCandidatePart[];
};

export type DepositMatchResult =
  | { readonly kind: "auto"; readonly targets: readonly DepositCandidate[]; readonly participantId?: number }
  | { readonly kind: "review"; readonly suggestions: readonly DepositCandidate[] };

const MAX_SUGGESTIONS = 5;

export function normalizeDepositorName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

export function remainingFee(candidate: Pick<DepositCandidate, "totalFee" | "paidAmount">): number {
  return Math.max(candidate.totalFee - candidate.paidAmount, 0);
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
  const exact = byName.filter((candidate) => remainingFee(candidate) === deposit.amount);
  if (exact.length === 1) return { kind: "auto", targets: exact };

  if (exact.length === 0 && byName.length > 1) {
    const recipients = new Set(byName.map((candidate) => candidate.recipientKakaoId));
    const sum = byName.reduce((total, candidate) => total + remainingFee(candidate), 0);
    if (recipients.size === 1 && sum === deposit.amount) return { kind: "auto", targets: byName };
  }

  const partMatches = name === null || exact.length > 0
    ? []
    : candidates.flatMap((candidate) => candidate.parts
        .filter((part) => (
          !part.paid
          && normalizeDepositorName(part.name) === name
          && part.amount === deposit.amount
          && deposit.amount < remainingFee(candidate)
        ))
        .map((part) => ({ candidate, part })));
  if (partMatches.length === 1) {
    return { kind: "auto", targets: [partMatches[0].candidate], participantId: partMatches[0].part.participantId };
  }

  const isPartName = (candidate: DepositCandidate) =>
    name !== null && candidate.parts.some((part) => normalizeDepositorName(part.name) === name);
  const isPartialName = (candidate: DepositCandidate) => {
    if (!name || name.length < 2) return false;
    const recipient = normalizeDepositorName(candidate.recipientName);
    return recipient.length >= 2 && (recipient.includes(name) || name.includes(recipient));
  };
  const rank = (candidate: DepositCandidate) => {
    const amountMatch = remainingFee(candidate) === deposit.amount
      || candidate.parts.some((part) => !part.paid && part.amount === deposit.amount);
    if (isNameMatch(candidate) || isPartName(candidate)) return amountMatch ? 0 : 1;
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

export type DepositAllocation = {
  readonly meetingId: number;
  readonly recipientKakaoId: string;
  readonly amount: number;
  readonly billTotal: number;
  /** 이 입금으로 청구를 다 받았는지 */
  readonly settles: boolean;
};

export type DepositAllocationPlan =
  | { readonly kind: "ok"; readonly allocations: readonly DepositAllocation[]; readonly overpaid: number }
  | { readonly kind: "error"; readonly message: string };

/**
 * 입금액을 고른 청구들에 나눈다. 각 청구의 남은 금액부터 채우고, 남는 돈은 마지막 청구에 더 받은 금액으로 붙인다.
 * 적게 들어온 경우는 청구 하나일 때만 일부 입금으로 받는다. 여러 청구를 한 번에 일부만 확인하면 어느 쪽이 덜 냈는지 알 수 없다.
 */
export function planDepositAllocation(
  amount: number,
  targets: readonly DepositCandidate[],
): DepositAllocationPlan {
  if (targets.length === 0) return { kind: "error", message: "연결할 청구를 선택해 주세요." };
  const owed = targets.map(remainingFee);
  const owedSum = owed.reduce((total, value) => total + value, 0);
  if (targets.length > 1 && amount < owedSum) {
    return { kind: "error", message: "여러 청구를 한 입금으로 확인하려면 입금액이 남은 금액 합계 이상이어야 합니다." };
  }

  const overpaid = Math.max(amount - owedSum, 0);
  const allocations = targets.map((target, index) => {
    const last = index === targets.length - 1;
    const share = targets.length === 1 ? amount : owed[index] + (last ? overpaid : 0);
    return {
      meetingId: target.meetingId,
      recipientKakaoId: target.recipientKakaoId,
      amount: share,
      billTotal: target.totalFee,
      settles: target.paidAmount + share >= target.totalFee,
    };
  });
  return { kind: "ok", allocations, overpaid };
}
