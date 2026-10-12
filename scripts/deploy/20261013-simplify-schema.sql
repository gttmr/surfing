-- 2026-10-13 운영 DB 구조 단순화 (refactor/simplify-schema)
-- - 1박: 날짜별 모임 2개 + 1박 묶음 → 모임 하나(시작일·종료일). 둘째 날 참가·이용·주문은 첫날 모임으로 합친다.
-- - 참가비·숙박비를 모임마다 저장한다.
-- - 이용 항목표를 모든 모임 공통 하나로, 정회원 가격 하나로(0 = 지원, 금액 = 고정, null = 샵 가격).
-- - 이용 확정은 참가자의 확정 시각, 불참은 불참 시각 하나로.
-- - 청구 상태는 공개 시각 하나로, 식음료 지급은 샵 지급에 합친다.
-- 적용: scripts/deploy/apply-prod-schema.sh (트랜잭션 하나로 실행, 실패하면 전부 취소)
BEGIN;
SET LOCAL ROLE postgres;
SET LOCAL lock_timeout = '5s';

-- (A) 데이터 옮기기: 새 칸을 만들고 값을 채운 뒤, 1박 둘째 날 기록을 첫날 모임으로 합친다.
-- (B) 는 prisma migrate diff 가 만든 구조 변경(옛 칸·테이블 삭제, NOT NULL, 인덱스)이다.

-- 안전장치: 둘째 날에만 있는 참가자나, 둘째 날 모임에 붙은 청구·입금 확인이 있으면 멈춘다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Meeting" m2 JOIN "Participant" d ON d."meetingId" = m2.id
    WHERE m2."groupDayIndex" = 2 AND NOT EXISTS (
      SELECT 1 FROM "Meeting" m1 JOIN "Participant" p ON p."meetingId" = m1.id
      WHERE m1."meetingGroupId" = m2."meetingGroupId" AND m1."groupDayIndex" = 1
        AND p."kakaoId" = d."kakaoId" AND p."companionId" IS NOT DISTINCT FROM d."companionId")
  ) THEN RAISE EXCEPTION '둘째 날에만 있는 참가자가 있어 합칠 수 없습니다.'; END IF;
  IF EXISTS (SELECT 1 FROM "SettlementConfirmation" c JOIN "Meeting" m ON m.id = c."meetingId" WHERE m."groupDayIndex" = 2)
    OR EXISTS (SELECT 1 FROM "MeetingBillingSnapshot" s JOIN "Meeting" m ON m.id = s."meetingId" WHERE m."groupDayIndex" = 2)
  THEN RAISE EXCEPTION '둘째 날 모임에 청구 기록이 있어 합칠 수 없습니다.'; END IF;
END $$;

-- 1. 모임: 일정 끝 날짜와 모임별 참가비
ALTER TABLE "Meeting" ADD COLUMN "endDate" TEXT,
  ADD COLUMN "regularFee" INTEGER,
  ADD COLUMN "companionFee" INTEGER,
  ADD COLUMN "lodgingFee" INTEGER NOT NULL DEFAULT 0;

-- 1박: 첫날 모임이 일정 전체를 맡는다(끝 날짜·종료 시각은 둘째 날 것, 요금은 1박 묶음 것).
UPDATE "Meeting" m1 SET
  "endDate" = m2.date,
  "endTime" = m2."endTime",
  "regularFee" = g."regularBaseFee",
  "companionFee" = g."companionBaseFee",
  "lodgingFee" = g."lodgingFee"
FROM "Meeting" m2, "MeetingGroup" g
WHERE m1."meetingGroupId" = g.id AND m2."meetingGroupId" = g.id
  AND m1."groupDayIndex" = 1 AND m2."groupDayIndex" = 2;

-- 당일 모임: 지금 요금 설정의 기본 참가비 (지금까지 청구 계산에 쓰던 값)
UPDATE "Meeting" SET
  "regularFee" = COALESCE((SELECT NULLIF(value, '')::int FROM "Setting" WHERE key = 'pricing_regular_base_fee'), 0),
  "companionFee" = COALESCE((SELECT NULLIF(value, '')::int FROM "Setting" WHERE key = 'pricing_companion_base_fee'), 0)
WHERE "meetingGroupId" IS NULL;

-- 2. 청구 상태: "청구 열림"은 공개 시각 하나로, 식음료 지급은 샵 지급에 합친다.
UPDATE "Meeting" SET "billingPublishedAt" = COALESCE("billingPublishedAt", "settlementCompletedAt", "billingReviewConfirmedAt", "createdAt")
WHERE "settlementOpen" = true;
UPDATE "Meeting" SET "billingPublishedAt" = NULL, "billingPublishedByKakaoId" = NULL WHERE "settlementOpen" = false;
UPDATE "Meeting" SET
  "shopPaidAmount" = COALESCE("shopPaidAmount", 0) + COALESCE("foodPaidAmount", 0),
  "shopPaidAt" = GREATEST("shopPaidAt", "foodPaidAt")
WHERE "shopPaidAt" IS NOT NULL OR "foodPaidAt" IS NOT NULL;

-- 3. 참가자: 둘째 날 장비, 불참 시각, 실제 이용 기록·확정 시각
ALTER TABLE "Participant" ADD COLUMN "hasDay2Rental" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "absentAt" TIMESTAMP(3),
  ADD COLUMN "usageSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "usageConfirmedAt" TIMESTAMP(3);

UPDATE "Participant" SET "absentAt" = COALESCE("attendanceUpdatedAt", "submittedAt") WHERE "attendanceStatus" = 'ABSENT';

UPDATE "Participant" p SET
  "usageSubmittedAt" = s."submittedAt",
  "usageConfirmedAt" = CASE WHEN s.status = 'CONFIRMED' THEN COALESCE(s."confirmedAt", s."updatedAt") END
FROM "ParticipantSurfUsageSubmission" s
WHERE s."participantId" = p.id;

-- 4. 이용 기록: 날짜, 정회원 가격 하나로
ALTER TABLE "ParticipantSurfUsage" ADD COLUMN "day" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "regularPriceSnapshot" INTEGER;
UPDATE "ParticipantSurfUsage" SET "regularPriceSnapshot" = CASE "memberBillingPolicySnapshot"
  WHEN 'ALL_SHOP' THEN NULL
  WHEN 'REGULAR_FIXED_COMPANION_SHOP' THEN "regularMemberPriceSnapshot"
  ELSE 0 END;

-- 5. 1박 둘째 날을 첫날 모임으로 합친다. 같은 사람(카카오ID+동반인)끼리 짝짓는다.
CREATE TEMP TABLE day_pair ON COMMIT DROP AS
SELECT m1.id AS day1_meeting, m2.id AS day2_meeting, p1.id AS p1, p2.id AS p2
FROM "Meeting" m1
JOIN "Meeting" m2 ON m2."meetingGroupId" = m1."meetingGroupId" AND m2."groupDayIndex" = 2
JOIN "Participant" p1 ON p1."meetingId" = m1.id
JOIN "Participant" p2 ON p2."meetingId" = m2.id
  AND p2."kakaoId" = p1."kakaoId" AND p2."companionId" IS NOT DISTINCT FROM p1."companionId"
WHERE m1."groupDayIndex" = 1;

-- 둘째 날 장비 신청, 이용 확정은 두 날 모두 확정됐을 때만 확정으로 본다.
UPDATE "Participant" p SET
  "hasDay2Rental" = d.has_rental,
  "usageSubmittedAt" = d.submitted_at,
  "usageConfirmedAt" = d.confirmed_at
FROM (
  SELECT dp.p1,
    p2."hasRental" AS has_rental,
    GREATEST(p1."usageSubmittedAt", p2."usageSubmittedAt") AS submitted_at,
    CASE WHEN p1."usageConfirmedAt" IS NOT NULL AND p2."usageConfirmedAt" IS NOT NULL
      THEN GREATEST(p1."usageConfirmedAt", p2."usageConfirmedAt") END AS confirmed_at
  FROM day_pair dp JOIN "Participant" p1 ON p1.id = dp.p1 JOIN "Participant" p2 ON p2.id = dp.p2
) d
WHERE p.id = d.p1;

UPDATE "ParticipantSurfUsage" u SET "meetingId" = dp.day1_meeting, "participantId" = dp.p1, "day" = 2
FROM day_pair dp WHERE u."participantId" = dp.p2;
UPDATE "ParticipantFoodOrder" o SET "meetingId" = dp.day1_meeting, "participantId" = dp.p1
FROM day_pair dp WHERE o."participantId" = dp.p2;
UPDATE "ParticipantFoodOrderItem" i SET "meetingId" = dp.day1_meeting, "participantId" = dp.p1
FROM day_pair dp WHERE i."participantId" = dp.p2;
UPDATE "ParticipantChargeAdjustment" a SET "meetingId" = dp.day1_meeting, "participantId" = dp.p1
FROM day_pair dp WHERE a."participantId" = dp.p2;
UPDATE "UserNotification" n SET "participantId" = dp.p1
FROM day_pair dp WHERE n."participantId" = dp.p2;
UPDATE "UserNotification" n SET "meetingId" = m1.id
FROM "Meeting" m2 JOIN "Meeting" m1 ON m1."meetingGroupId" = m2."meetingGroupId" AND m1."groupDayIndex" = 1
WHERE n."meetingId" = m2.id AND m2."groupDayIndex" = 2;

-- 6. 이용 항목표를 모든 모임 공통 하나로: 같은 항목(이름·종류·가격)은 가장 먼저 만든 것만 남긴다.
ALTER TABLE "SurfUsageItem" ADD COLUMN "regularPrice" INTEGER;
UPDATE "SurfUsageItem" SET "regularPrice" = CASE "memberBillingPolicy"
  WHEN 'ALL_SHOP' THEN NULL
  WHEN 'REGULAR_FIXED_COMPANION_SHOP' THEN "regularMemberPrice"
  ELSE 0 END;

CREATE TEMP TABLE item_canonical ON COMMIT DROP AS
SELECT i.id, MIN(i.id) OVER (PARTITION BY i.name, i."serviceType", i."shopPrice", i."regularPrice") AS canonical_id
FROM "SurfUsageItem" i;

UPDATE "ParticipantSurfUsage" u SET "usageItemId" = c.canonical_id
FROM item_canonical c WHERE u."usageItemId" = c.id AND c.id <> c.canonical_id;
DELETE FROM "SurfUsageItem" i USING item_canonical c WHERE i.id = c.id AND c.id <> c.canonical_id;

-- 둘째 날 참가자·모임 삭제. 항목표는 이제 모임에 속하지 않으므로 모임 삭제에 딸려 지워지지 않게 연결을 먼저 끊는다.
-- (1박 묶음 테이블과 meetingGroupId 는 (B) 에서 외래키를 먼저 지운 뒤 없앤다. 여기서 묶음을 지우면 첫날 모임까지 지워진다.)
ALTER TABLE "SurfUsageItem" DROP CONSTRAINT "SurfUsageItem_meetingId_fkey";
DELETE FROM "Participant" p USING day_pair dp WHERE p.id = dp.p2;
DELETE FROM "Meeting" WHERE "groupDayIndex" = 2;

-- 7. 이제 쓰지 않는 요금 설정(강습·장비는 이용 항목표 가격을 쓴다)
DELETE FROM "Setting" WHERE key IN (
  'pricing_regular_lesson_fee', 'pricing_companion_lesson_fee',
  'pricing_regular_rental_fee', 'pricing_companion_rental_fee');

-- (B) 구조 변경 (prisma migrate diff)
-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_meetingGroupId_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantSurfUsageSubmission" DROP CONSTRAINT "ParticipantSurfUsageSubmission_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantSurfUsageSubmission" DROP CONSTRAINT "ParticipantSurfUsageSubmission_participantId_fkey";

-- DropIndex
DROP INDEX "Meeting_meetingGroupId_groupDayIndex_key";

-- DropIndex
DROP INDEX "Meeting_meetingGroupId_idx";

-- DropIndex
DROP INDEX "SurfUsageItem_meetingId_displayOrder_idx";

-- DropIndex
DROP INDEX "SurfUsageItem_meetingId_serviceType_idx";

-- AlterTable
ALTER TABLE "Meeting" DROP COLUMN "billingReviewConfirmedAt",
DROP COLUMN "billingReviewConfirmedByKakaoId",
DROP COLUMN "foodPaidAmount",
DROP COLUMN "foodPaidAt",
DROP COLUMN "groupDayIndex",
DROP COLUMN "meetingGroupId",
DROP COLUMN "settlementOpen",
ALTER COLUMN "regularFee" SET NOT NULL,
ALTER COLUMN "companionFee" SET NOT NULL;

-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "attendanceStatus",
DROP COLUMN "attendanceUpdatedAt",
DROP COLUMN "attendanceUpdatedByKakaoId";

-- AlterTable
ALTER TABLE "ParticipantSurfUsage" DROP COLUMN "memberBillingPolicySnapshot",
DROP COLUMN "note",
DROP COLUMN "regularMemberPriceSnapshot";

-- AlterTable
ALTER TABLE "SurfUsageItem" DROP COLUMN "createdByKakaoId",
DROP COLUMN "isDefault",
DROP COLUMN "meetingId",
DROP COLUMN "memberBillingPolicy",
DROP COLUMN "regularMemberPrice";

-- DropTable
DROP TABLE "MeetingGroup";

-- DropTable
DROP TABLE "ParticipantSurfUsageSubmission";


COMMIT;
