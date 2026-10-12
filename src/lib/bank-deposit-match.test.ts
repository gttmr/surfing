import assert from "node:assert/strict";
import test from "node:test";
import { matchDeposit, type DepositCandidate } from "@/lib/bank-deposit-match";

function candidate(recipientKakaoId: string, recipientName: string, totalFee: number, meetingId = 1): DepositCandidate {
  return { meetingId, meetingLabel: `모임 ${meetingId}`, recipientKakaoId, recipientName, totalFee };
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
