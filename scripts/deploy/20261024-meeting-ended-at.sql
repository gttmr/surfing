-- 2026-10-24 운영 DB 스키마 추가분 (feat/meeting-end-anytime)
-- 추가만 한다: Meeting 에 nullable 컬럼 하나. 기존 데이터·컬럼은 건드리지 않는다.
-- 기존 코드가 그대로 동작하므로 코드 배포보다 먼저 적용한다.
-- 적용: scripts/deploy/apply-prod-schema.sh (트랜잭션 하나로 실행, 실패하면 전부 취소)
BEGIN;
SET LOCAL ROLE postgres;
SET LOCAL lock_timeout = '5s';

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "endedAt" TIMESTAMP(3);

COMMIT;
