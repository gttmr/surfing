-- 2026-10-24 운영 DB 스키마 추가분 (feat/deposit-amount-check)
-- 추가만 한다: 입금↔청구 연결 표(BankDepositPayment) 하나. 기존 표·컬럼은 건드리지 않는다.
-- 기존 코드는 이 표를 모르므로 코드 배포보다 먼저 적용해도 된다.
-- 이미 입금으로 확인된 청구는 연결을 옮겨 적는다. 금액은 입금이 청구 하나만 확인했으면 입금액 전부,
-- 여러 청구를 확인했으면 각 청구 금액(공개 당시 스냅샷)이다.
-- 적용: scripts/deploy/apply-prod-schema.sh (트랜잭션 하나로 실행, 실패하면 전부 취소)
BEGIN;
SET LOCAL ROLE postgres;
SET LOCAL lock_timeout = '5s';

CREATE TABLE "BankDepositPayment" (
    "id" SERIAL NOT NULL,
    "depositId" INTEGER NOT NULL,
    "meetingId" INTEGER NOT NULL,
    "recipientKakaoId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "billTotal" INTEGER NOT NULL,
    "participantId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankDepositPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankDepositPayment_meetingId_recipientKakaoId_idx" ON "BankDepositPayment"("meetingId", "recipientKakaoId");
CREATE UNIQUE INDEX "BankDepositPayment_depositId_meetingId_recipientKakaoId_key" ON "BankDepositPayment"("depositId", "meetingId", "recipientKakaoId");

ALTER TABLE "BankDepositPayment" ADD CONSTRAINT "BankDepositPayment_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "BankDeposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankDepositPayment" ADD CONSTRAINT "BankDepositPayment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 기존 확인 기록 옮기기
INSERT INTO "BankDepositPayment" ("depositId", "meetingId", "recipientKakaoId", "amount", "billTotal")
SELECT c."depositId", c."meetingId", c."recipientKakaoId",
       CASE WHEN (SELECT count(*) FROM "SettlementConfirmation" o WHERE o."depositId" = c."depositId") = 1
            THEN d."amount" ELSE bill.total END,
       bill.total
FROM "SettlementConfirmation" c
JOIN "BankDeposit" d ON d."id" = c."depositId"
JOIN "MeetingBillingSnapshot" s ON s."meetingId" = c."meetingId"
CROSS JOIN LATERAL (
  SELECT (r->>'totalFee')::int AS total
  FROM jsonb_array_elements(s."data"->'recipients') r
  WHERE r->>'recipientKakaoId' = c."recipientKakaoId"
  LIMIT 1
) bill
WHERE c."depositId" IS NOT NULL AND c."verifiedAt" IS NOT NULL AND d."amount" IS NOT NULL;

COMMIT;
