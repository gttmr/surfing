import assert from "node:assert/strict";
import test from "node:test";
import { parseDepositNotification } from "@/lib/bank-deposit-parse";

test("deposit notifications yield depositor name and amount across common phrasings", () => {
  assert.deepEqual(parseDepositNotification("입금 45,000원", "홍길동 → 모임통장"), {
    kind: "deposit", depositorName: "홍길동", amount: 45000,
  });
  assert.deepEqual(parseDepositNotification("토스뱅크", "홍길동님이 45,000원을 보냈어요"), {
    kind: "deposit", depositorName: "홍길동", amount: 45000,
  });
  assert.deepEqual(parseDepositNotification("입금", "입금자: 김철수 35000원"), {
    kind: "deposit", depositorName: "김철수", amount: 35000,
  });
  assert.deepEqual(parseDepositNotification("45,000원 입금", "이영희 | 잔액 1,234,000원"), {
    kind: "deposit", depositorName: "이영희", amount: 45000,
  });
});

test("the balance amount is never mistaken for the deposit amount", () => {
  const parsed = parseDepositNotification(null, "잔액 980,000원 · 입금 50,000원 박민수");
  assert.deepEqual(parsed, { kind: "deposit", depositorName: "박민수", amount: 50000 });
});

test("outgoing transfers and payments are ignored", () => {
  assert.deepEqual(parseDepositNotification("출금 30,000원", "서프샵 → 출금"), { kind: "ignored", reason: "outgoing" });
  assert.deepEqual(parseDepositNotification("토스뱅크", "홍길동님에게 30,000원을 보냈어요"), { kind: "ignored", reason: "outgoing" });
  assert.deepEqual(parseDepositNotification("체크카드 결제", "12,000원 편의점"), { kind: "ignored", reason: "outgoing" });
});

test("unrelated notifications are reported as unparsed", () => {
  assert.deepEqual(parseDepositNotification("토스뱅크", "이번 달 혜택을 확인해 보세요"), { kind: "unparsed" });
  assert.deepEqual(parseDepositNotification("입금", "금액 정보 없음"), { kind: "unparsed" });
});

test("a deposit without a recognizable name keeps the amount for manual matching", () => {
  assert.deepEqual(parseDepositNotification("입금 20,000원", ""), { kind: "deposit", depositorName: null, amount: 20000 });
});
