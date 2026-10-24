import assert from "node:assert/strict";
import test from "node:test";
import { matchDeposit, planDepositAllocation, type DepositCandidate } from "@/lib/bank-deposit-match";

function candidate(recipientKakaoId: string, recipientName: string, totalFee: number, meetingId = 1): DepositCandidate {
  return { meetingId, meetingLabel: `모임 ${meetingId}`, recipientKakaoId, recipientName, totalFee, paidAmount: 0, parts: [] };
}

const NO_ALIASES = new Map<string, string>();

test("a unique name and amount match is verified automatically", () => {
  const result = matchDeposit(
    { depositorName: "홍길동", amount: 45000 },
    [candidate("a", "홍길동", 45000), candidate("b", "김철수", 45000)],
    NO_ALIASES,
  );
  assert.deepEqual(result, { kind: "auto", targets: [candidate("a", "홍길동", 45000)] });
});

test("names match regardless of spacing", () => {
  const result = matchDeposit({ depositorName: "홍 길동", amount: 45000 }, [candidate("a", "홍길동 ", 45000)], NO_ALIASES);
  assert.equal(result.kind, "auto");
});

test("a remembered depositor alias matches its member", () => {
  const result = matchDeposit(
    { depositorName: "김엄마", amount: 50000 },
    [candidate("a", "김철수", 50000)],
    new Map([["김엄마", "a"]]),
  );
  assert.deepEqual(result, { kind: "auto", targets: [candidate("a", "김철수", 50000)] });
});

test("one transfer covering all of a member's open bills matches every bill", () => {
  const bills = [candidate("a", "홍길동", 45000, 1), candidate("a", "홍길동", 30000, 2)];
  assert.deepEqual(matchDeposit({ depositorName: "홍길동", amount: 75000 }, bills, NO_ALIASES), { kind: "auto", targets: bills });
});

test("a wrong amount is never auto-verified but is suggested first", () => {
  const result = matchDeposit(
    { depositorName: "홍길동", amount: 40000 },
    [candidate("b", "김철수", 40000), candidate("a", "홍길동", 45000)],
    NO_ALIASES,
  );
  assert.equal(result.kind, "review");
  assert.deepEqual(result.kind === "review" && result.suggestions.map((item) => item.recipientKakaoId), ["a", "b"]);
});

test("two members with the same name and amount need a human decision", () => {
  const result = matchDeposit(
    { depositorName: "홍길동", amount: 45000 },
    [candidate("a", "홍길동", 45000), candidate("b", "홍길동", 45000)],
    NO_ALIASES,
  );
  assert.equal(result.kind, "review");
});

test("the same member owing the same amount on two meetings needs a human decision", () => {
  const result = matchDeposit(
    { depositorName: "홍길동", amount: 45000 },
    [candidate("a", "홍길동", 45000, 1), candidate("a", "홍길동", 45000, 2)],
    NO_ALIASES,
  );
  assert.equal(result.kind, "review");
});

test("an unknown depositor gets amount-only and partial-name suggestions", () => {
  const result = matchDeposit(
    { depositorName: "홍길동엄마", amount: 45000 },
    [candidate("c", "박민수", 45000), candidate("a", "홍길동", 30000), candidate("d", "이영희", 10000)],
    NO_ALIASES,
  );
  assert.deepEqual(result.kind === "review" && result.suggestions.map((item) => item.recipientKakaoId), ["a", "c"]);
});

test("a deposit without a name is never auto-verified", () => {
  const result = matchDeposit({ depositorName: null, amount: 45000 }, [candidate("a", "홍길동", 45000)], NO_ALIASES);
  assert.deepEqual(result, { kind: "review", suggestions: [candidate("a", "홍길동", 45000)] });
});

// 정회원 유가현(41,000)과 동반인 이세라(105,000)가 한 청구(146,000)로 묶인 경우
function household(paidAmount = 0, seraPaid = false): DepositCandidate {
  return {
    ...candidate("yu", "유가현", 146000),
    paidAmount,
    parts: [
      { participantId: 1, name: "유가현", amount: 41000, paid: false },
      { participantId: 2, name: "이세라", amount: 105000, paid: seraPaid },
    ],
  };
}

test("a companion paying exactly their own share is recorded as part of the member's bill", () => {
  const result = matchDeposit({ depositorName: "이세라", amount: 105000 }, [household()], NO_ALIASES);
  assert.deepEqual(result, { kind: "auto", targets: [household()], participantId: 2 });
});

test("after a companion's share arrives, the member's exact remainder settles the bill", () => {
  const bill = household(105000, true);
  assert.deepEqual(matchDeposit({ depositorName: "유가현", amount: 41000 }, [bill], NO_ALIASES), { kind: "auto", targets: [bill] });
});

test("a member sending more than the remainder is never auto-verified", () => {
  const result = matchDeposit({ depositorName: "유가현", amount: 46000 }, [household(105000, true)], NO_ALIASES);
  assert.equal(result.kind, "review");
});

test("a share that was already paid is not matched again", () => {
  const result = matchDeposit({ depositorName: "이세라", amount: 105000 }, [{ ...household(105000, true), paidAmount: 105000 }], NO_ALIASES);
  assert.equal(result.kind, "review");
});

test("a short deposit to one bill is kept as a partial payment", () => {
  const plan = planDepositAllocation(46000, [household()]);
  assert.deepEqual(plan, {
    kind: "ok",
    overpaid: 0,
    allocations: [{ meetingId: 1, recipientKakaoId: "yu", amount: 46000, billTotal: 146000, settles: false }],
  });
});

test("an overpayment settles the bill and reports the extra amount", () => {
  const plan = planDepositAllocation(46000, [household(105000, true)]);
  assert.equal(plan.kind === "ok" && plan.overpaid, 5000);
  assert.equal(plan.kind === "ok" && plan.allocations[0].settles, true);
});

test("one short deposit cannot be spread over several bills", () => {
  const plan = planDepositAllocation(50000, [candidate("a", "홍길동", 45000, 1), candidate("a", "홍길동", 30000, 2)]);
  assert.equal(plan.kind, "error");
});
