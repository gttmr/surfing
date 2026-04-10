/**
 * One-time DB migration: 주문 이력 관리 구조 전환
 *
 * ParticipantFoodOrderItem 의 @@unique([participantId, menuItemId]) 를 제거하고
 * 상위 ParticipantFoodOrder 배치 테이블을 추가합니다.
 *
 * 실행 (기존 데이터 보존):
 *   npx tsx scripts/migrate-food-order-history.ts
 *   npx prisma generate
 *
 * 데이터가 없거나 초기화해도 된다면:
 *   npx prisma db push --force-reset && npx prisma generate
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("주문 이력 구조 마이그레이션 시작...");

  await prisma.$transaction(async (tx) => {
    // 1. ParticipantFoodOrder 테이블 생성 (존재하면 건너뜀)
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ParticipantFoodOrder" (
        "id"            SERIAL NOT NULL,
        "meetingId"     INTEGER NOT NULL,
        "participantId" INTEGER NOT NULL,
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ParticipantFoodOrder_pkey" PRIMARY KEY ("id")
      )
    `);

    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ParticipantFoodOrder_meetingId_participantId_idx"
        ON "ParticipantFoodOrder"("meetingId", "participantId")
    `);

    // FK는 이미 있으면 오류 나므로 체크 후 추가
    await tx.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ParticipantFoodOrder"
          ADD CONSTRAINT "ParticipantFoodOrder_meetingId_fkey"
          FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await tx.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ParticipantFoodOrder"
          ADD CONSTRAINT "ParticipantFoodOrder_participantId_fkey"
          FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // 2. foodOrderId 컬럼 추가 (nullable)
    await tx.$executeRawUnsafe(`
      ALTER TABLE "ParticipantFoodOrderItem"
        ADD COLUMN IF NOT EXISTS "foodOrderId" INTEGER
    `);

    // 3. 기존 아이템 백필: (participantId, meetingId) 그룹 → ParticipantFoodOrder 1개 생성
    await tx.$executeRawUnsafe(`
      INSERT INTO "ParticipantFoodOrder" ("meetingId", "participantId", "createdAt")
      SELECT DISTINCT pfi."meetingId", pfi."participantId", MIN(pfi."createdAt")
      FROM "ParticipantFoodOrderItem" pfi
      WHERE pfi."foodOrderId" IS NULL
      GROUP BY pfi."meetingId", pfi."participantId"
    `);

    await tx.$executeRawUnsafe(`
      UPDATE "ParticipantFoodOrderItem" pfi
      SET "foodOrderId" = fo."id"
      FROM "ParticipantFoodOrder" fo
      WHERE pfi."participantId" = fo."participantId"
        AND pfi."meetingId" = fo."meetingId"
        AND pfi."foodOrderId" IS NULL
    `);

    // 4. foodOrderId NOT NULL 설정
    await tx.$executeRawUnsafe(`
      ALTER TABLE "ParticipantFoodOrderItem"
        ALTER COLUMN "foodOrderId" SET NOT NULL
    `);

    // 5. FK 추가
    await tx.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ParticipantFoodOrderItem"
          ADD CONSTRAINT "ParticipantFoodOrderItem_foodOrderId_fkey"
          FOREIGN KEY ("foodOrderId") REFERENCES "ParticipantFoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ParticipantFoodOrderItem_foodOrderId_idx"
        ON "ParticipantFoodOrderItem"("foodOrderId")
    `);

    // 6. 기존 unique constraint 제거
    await tx.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ParticipantFoodOrderItem"
          DROP CONSTRAINT "ParticipantFoodOrderItem_participantId_menuItemId_key";
      EXCEPTION WHEN undefined_object THEN NULL;
      END $$
    `);
  });

  // 결과 확인
  const orderCount = await prisma.participantFoodOrder.count();
  const itemCount = await prisma.participantFoodOrderItem.count();
  console.log(`완료: ParticipantFoodOrder ${orderCount}개, ParticipantFoodOrderItem ${itemCount}개`);
}

main()
  .catch((e) => {
    console.error("마이그레이션 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
