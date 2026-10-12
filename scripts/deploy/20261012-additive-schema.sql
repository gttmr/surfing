-- 2026-10-12 운영 DB 스키마 추가분 (feat/dev-mode-and-bank-deposit-matching)
-- 추가만 한다: Meeting 에 nullable 컬럼 2개, 입금 대조용 테이블 4개. 기존 데이터·컬럼은 건드리지 않는다.
-- 기존 코드가 그대로 동작하므로 코드 배포보다 먼저 적용한다.
-- 적용: scripts/deploy/apply-prod-schema.sh (트랜잭션 하나로 실행, 실패하면 전부 취소)
BEGIN;
SET LOCAL ROLE postgres;
SET LOCAL lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "shopUsageCheckedAt" TIMESTAMP(3),
ADD COLUMN     "shopUsageCheckedByKakaoId" TEXT;

-- CreateTable
CREATE TABLE "BankDeposit" (
    "id" SERIAL NOT NULL,
    "rawTitle" TEXT,
    "rawText" TEXT NOT NULL,
    "depositorName" TEXT,
    "amount" INTEGER,
    "depositedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchedByKakaoId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "sourceDeviceId" INTEGER,

    CONSTRAINT "BankDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankDepositMatch" (
    "id" SERIAL NOT NULL,
    "depositId" INTEGER NOT NULL,
    "meetingId" INTEGER NOT NULL,
    "recipientKakaoId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "BankDepositMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositorAlias" (
    "id" SERIAL NOT NULL,
    "depositorName" TEXT NOT NULL,
    "kakaoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositorAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankWebhookDevice" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "BankWebhookDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankDeposit_status_depositedAt_idx" ON "BankDeposit"("status", "depositedAt");

-- CreateIndex
CREATE INDEX "BankDeposit_rawText_depositedAt_idx" ON "BankDeposit"("rawText", "depositedAt");

-- CreateIndex
CREATE INDEX "BankDepositMatch_depositId_idx" ON "BankDepositMatch"("depositId");

-- CreateIndex
CREATE UNIQUE INDEX "BankDepositMatch_meetingId_recipientKakaoId_key" ON "BankDepositMatch"("meetingId", "recipientKakaoId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositorAlias_depositorName_key" ON "DepositorAlias"("depositorName");

-- CreateIndex
CREATE UNIQUE INDEX "BankWebhookDevice_tokenHash_key" ON "BankWebhookDevice"("tokenHash");

-- AddForeignKey
ALTER TABLE "BankDepositMatch" ADD CONSTRAINT "BankDepositMatch_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "BankDeposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 입금 정보는 민감하다. 앱은 Prisma(postgres 소유자)로만 접근하므로 RLS 를 켜도 영향이 없고,
-- Supabase REST API(anon/authenticated)로는 읽을 수 없게 된다.
ALTER TABLE "BankDeposit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankDepositMatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DepositorAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankWebhookDevice" ENABLE ROW LEVEL SECURITY;

COMMIT;
