import { join } from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getTodayInSeoul } from "../../src/lib/date";
import { buildMobileUxFixture, type FixtureOrderItem } from "../../tests/fixtures/mobile-ux";
import { assertFixedDatabaseEnvironment } from "./assert-local-test-db";
import { writeJsonEvidence } from "./evidence";
import { verifyTransitiveGuardCapability } from "./private-capability";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

export class MobileUxSeedError extends Error {
  readonly name = "MobileUxSeedError";
}

type SeedInspection = {
  readonly checksum: string;
  readonly generation: string;
  readonly counts: {
    readonly users: number;
    readonly meetings: number;
    readonly menus: number;
    readonly activeMenus: number;
    readonly activeVariants: number;
  };
  readonly meetingIds: readonly number[];
  readonly roles: readonly string[];
  readonly companionLinks: { readonly linked: number; readonly unlinked: number };
  readonly orderStates: readonly string[];
  readonly usageStates: readonly string[];
  readonly repeatedSubmissionCount: number;
};

function orderState(item: FixtureOrderItem): {
  readonly preparingQuantity: number;
  readonly servedQuantity: number;
  readonly cancelledAt: Date | null;
  readonly cancelledReasonCode: string | null;
  readonly cancelledReasonText: string | null;
  readonly cancelledByKakaoId: string | null;
} {
  switch (item.state) {
    case "ACTIVE":
      return { preparingQuantity: 0, servedQuantity: 0, cancelledAt: null, cancelledReasonCode: null, cancelledReasonText: null, cancelledByKakaoId: null };
    case "PREPARING":
      return { preparingQuantity: item.quantity, servedQuantity: 0, cancelledAt: null, cancelledReasonCode: null, cancelledReasonText: null, cancelledByKakaoId: null };
    case "SERVED":
      return { preparingQuantity: 0, servedQuantity: item.quantity, cancelledAt: null, cancelledReasonCode: null, cancelledReasonText: null, cancelledByKakaoId: null };
    case "CANCELLED":
      return { preparingQuantity: 0, servedQuantity: 0, cancelledAt: CREATED_AT, cancelledReasonCode: "qa_cancelled", cancelledReasonText: "합성 취소 상태", cancelledByKakaoId: "qa-user-05" };
    default:
      return assertNever(item.state);
  }
}

function assertNever(value: never): never {
  throw new MobileUxSeedError(`unsupported order state: ${String(value)}`);
}

async function clearFixture(transaction: Prisma.TransactionClient): Promise<void> {
  await transaction.userNotification.deleteMany();
  await transaction.settlementConfirmation.deleteMany();
  await transaction.participantChargeAdjustment.deleteMany();
  await transaction.participantSurfUsage.deleteMany();
  await transaction.participantSurfUsageSubmission.deleteMany();
  await transaction.surfUsageItem.deleteMany();
  await transaction.participantFoodOrderItem.deleteMany();
  await transaction.participantFoodOrder.deleteMany();
  await transaction.participant.deleteMany();
  await transaction.meeting.deleteMany();
  await transaction.meetingGroup.deleteMany();
  await transaction.foodMenuOptionChoice.deleteMany();
  await transaction.foodMenuItem.deleteMany();
  await transaction.foodMenuCategory.deleteMany();
  await transaction.companion.deleteMany();
  await transaction.deletedKakaoId.deleteMany();
  await transaction.user.deleteMany();
  await transaction.notice.deleteMany();
  await transaction.setting.deleteMany();
}

async function insertFixture(
  transaction: Prisma.TransactionClient,
  generation: string
): Promise<string> {
  const fixture = buildMobileUxFixture(getTodayInSeoul());
  await transaction.user.createMany({ data: fixture.users.map((user) => ({ ...user, createdAt: CREATED_AT, updatedAt: CREATED_AT })) });
  await transaction.companion.createMany({ data: fixture.companions.map((companion) => ({ ...companion, createdAt: CREATED_AT })) });
  await transaction.meeting.createMany({ data: fixture.meetings.map((meeting) => ({ ...meeting, createdAt: CREATED_AT })) });
  await transaction.foodMenuCategory.createMany({ data: fixture.categories.map((category) => ({ ...category, createdAt: CREATED_AT, updatedAt: CREATED_AT })) });
  await transaction.foodMenuItem.createMany({ data: fixture.menus.map((menu) => ({ ...menu, createdAt: CREATED_AT, updatedAt: CREATED_AT })) });
  await transaction.foodMenuOptionChoice.createMany({ data: fixture.variants.flatMap((variant) => variant.id === null ? [] : [{ id: variant.id, menuItemId: variant.menuItemId, label: variant.label, price: variant.price, displayOrder: variant.displayOrder, createdAt: CREATED_AT, updatedAt: CREATED_AT }]) });
  await transaction.participant.createMany({ data: fixture.participants.map((participant) => ({
    ...participant,
    kakaoNickname: participant.name,
    note: participant.id === 8837 ? "미연동 동반인 합성 메모" : null,
    waitlistPosition: participant.status === "WAITLISTED" ? participant.id - 8830 : null,
    cancelledAt: participant.status === "CANCELLED" ? CREATED_AT : null,
    isPenalized: false,
    submittedAt: CREATED_AT,
  })) });
  await transaction.participantFoodOrder.createMany({ data: [
    { id: 8901, meetingId: 8101, participantId: 8801, createdAt: new Date("2026-01-01T01:00:00.000Z") },
    { id: 8902, meetingId: 8101, participantId: 8801, createdAt: new Date("2026-01-01T02:00:00.000Z") },
    { id: 8903, meetingId: 8101, participantId: 8802, createdAt: new Date("2026-01-01T03:00:00.000Z") },
    { id: 8904, meetingId: 8101, participantId: 8803, createdAt: new Date("2026-01-01T04:00:00.000Z") },
    { id: 8905, meetingId: 8101, participantId: 8804, createdAt: new Date("2026-01-01T05:00:00.000Z") },
  ] });
  const menuById = new Map(fixture.menus.map((menu) => [menu.id, menu]));
  const variantById = new Map(fixture.variants.flatMap((variant) => variant.id === null ? [] : [[variant.id, variant] as const]));
  await transaction.participantFoodOrderItem.createMany({ data: fixture.orderItems.map((item) => {
    const menu = menuById.get(item.menuItemId);
    const variant = item.variantId === null ? null : variantById.get(item.variantId);
    if (!menu || (item.variantId !== null && !variant)) {
      throw new MobileUxSeedError(`fixture order item ${item.id} has an unknown variant`);
    }
    return {
      id: item.id,
      meetingId: 8101,
      participantId: item.participantId,
      foodOrderId: item.foodOrderId,
      menuItemId: item.menuItemId,
      menuOptionChoiceId: item.variantId,
      menuNameSnapshot: menu.name,
      optionGroupNameSnapshot: menu.optionGroupName,
      optionChoiceLabelSnapshot: variant?.label ?? null,
      unitPriceSnapshot: variant?.price ?? menu.price,
      quantity: item.quantity,
      ...orderState(item),
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    };
  }) });
  await transaction.surfUsageItem.createMany({ data: fixture.usageItems.map((item, index) => ({
    id: item.id,
    meetingId: 8101,
    name: item.name,
    description: "합성 이용 항목",
    serviceType: item.serviceType,
    shopPrice: item.price,
    memberBillingPolicy: "SHOP_PRICE",
    regularMemberPrice: item.price,
    isDefault: index < 2,
    isActive: true,
    displayOrder: index + 1,
    createdByKakaoId: "qa-user-05",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  })) });
  await transaction.participantSurfUsageSubmission.createMany({ data: fixture.usageSubmissions.map((submission) => ({
    ...submission,
    meetingId: 8101,
    submittedByKakaoId: "qa-user-04",
    submittedAt: CREATED_AT,
    updatedAt: CREATED_AT,
    confirmedAt: submission.status === "CONFIRMED" ? CREATED_AT : null,
    confirmedByKakaoId: submission.status === "CONFIRMED" ? "qa-user-04" : null,
  })) });
  await transaction.participantSurfUsage.createMany({ data: [
    { id: 9301, meetingId: 8101, participantId: 8801, usageItemId: 9101, quantity: 1, usageItemNameSnapshot: fixture.usageItems[0]?.name ?? "", serviceTypeSnapshot: "LESSON", shopUnitPriceSnapshot: 50_000, memberBillingPolicySnapshot: "SHOP_PRICE", regularMemberPriceSnapshot: 50_000, source: "shop", submittedByKakaoId: "qa-user-04", createdAt: CREATED_AT, updatedAt: CREATED_AT },
    { id: 9302, meetingId: 8101, participantId: 8802, usageItemId: 9102, quantity: 2, usageItemNameSnapshot: fixture.usageItems[1]?.name ?? "", serviceTypeSnapshot: "RENTAL", shopUnitPriceSnapshot: 30_000, memberBillingPolicySnapshot: "SHOP_PRICE", regularMemberPriceSnapshot: 30_000, source: "shop", submittedByKakaoId: "qa-user-04", createdAt: CREATED_AT, updatedAt: CREATED_AT },
  ] });
  await transaction.settlementConfirmation.create({ data: { id: 9401, meetingId: 8103, recipientKakaoId: "qa-user-01", confirmedAt: CREATED_AT } });
  await transaction.notice.createMany({ data: [
    { id: 9501, title: "합성 공지", body: "모바일 공지 목록과 읽기 상태를 위한 합성 내용입니다.", isPinned: true, createdAt: CREATED_AT, updatedAt: CREATED_AT },
    { id: 9502, title: "아주 긴 한글 합성 공지 제목으로 줄바꿈과 화면 밀도를 확인합니다", body: "외부 데이터가 아닌 결정적인 합성 문장입니다.", isPinned: false, createdAt: CREATED_AT, updatedAt: CREATED_AT },
  ] });
  await transaction.setting.createMany({ data: [
    ...fixture.settings,
    { key: "__qa_reset_generation", value: generation },
    { key: "__qa_fixture_checksum", value: fixture.checksum },
  ] });
  return fixture.checksum;
}

export async function inspectMobileUxSeed(client: PrismaClient): Promise<SeedInspection> {
  const [users, meetings, menus, activeMenus, checksum, generation, meetingRows, activeMenuRows, userRows, companions, orders, submissions, participantCount] = await Promise.all([
    client.user.count(),
    client.meeting.count(),
    client.foodMenuItem.count(),
    client.foodMenuItem.count({ where: { isActive: true } }),
    client.setting.findUnique({ where: { key: "__qa_fixture_checksum" } }),
    client.setting.findUnique({ where: { key: "__qa_reset_generation" } }),
    client.meeting.findMany({ select: { id: true }, orderBy: { id: "asc" } }),
    client.foodMenuItem.findMany({ where: { isActive: true }, select: { optionChoices: { select: { id: true } } } }),
    client.user.findMany({ select: { role: true }, orderBy: { id: "asc" } }),
    client.companion.findMany({ select: { linkedKakaoId: true } }),
    client.participantFoodOrder.findMany({ select: { participantId: true, items: { select: { quantity: true, preparingQuantity: true, servedQuantity: true, cancelledAt: true } } } }),
    client.participantSurfUsageSubmission.findMany({ select: { status: true } }),
    client.participant.count({ where: { meetingId: 8101 } }),
  ]);
  if (!checksum || !generation) {
    throw new MobileUxSeedError("fixture checksum or generation is missing after seed");
  }
  const orderStates = new Set<string>();
  for (const order of orders) {
    const parentStates = new Set(order.items.map((item) => item.cancelledAt ? "CANCELLED" : item.servedQuantity === item.quantity ? "SERVED" : item.preparingQuantity > 0 ? "PREPARING" : "ACTIVE"));
    for (const state of parentStates) orderStates.add(state);
    if (parentStates.size > 1) orderStates.add("MIXED");
  }
  const usageStates = new Set(submissions.map((submission) => submission.status));
  if (participantCount > submissions.length) usageStates.add("MISSING");
  return {
    checksum: checksum.value,
    generation: generation.value,
    counts: { users, meetings, menus, activeMenus, activeVariants: activeMenuRows.reduce((sum, menu) => sum + Math.max(1, menu.optionChoices.length), 0) },
    meetingIds: meetingRows.map((meeting) => meeting.id),
    roles: [...new Set(userRows.map((user) => user.role))].sort(),
    companionLinks: { linked: companions.filter((companion) => companion.linkedKakaoId !== null).length, unlinked: companions.filter((companion) => companion.linkedKakaoId === null).length },
    orderStates: [...orderStates].sort(),
    usageStates: [...usageStates].sort(),
    repeatedSubmissionCount: orders.filter((order) => order.participantId === 8801).length,
  };
}

export async function seedMobileUx(client: PrismaClient, generation: string, evidenceDirectory: string): Promise<SeedInspection> {
  assertFixedDatabaseEnvironment(process.env);
  verifyTransitiveGuardCapability();
  if (!UUID_PATTERN.test(generation)) {
    throw new MobileUxSeedError("seed generation must be a UUID");
  }
  const expectedChecksum = await client.$transaction(async (transaction) => {
    await clearFixture(transaction);
    return insertFixture(transaction, generation);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  const inspection = await inspectMobileUxSeed(client);
  if (inspection.checksum !== expectedChecksum || inspection.generation !== generation) {
    throw new MobileUxSeedError("seed inspection differs from deterministic fixture contract");
  }
  writeJsonEvidence(join(evidenceDirectory, "fixture-seed-receipt.json"), inspection);
  return inspection;
}
