import { createHash } from "node:crypto";

export const MOBILE_UX_FIXTURE_IDS = {
  meetings: [8101, 8102, 8103, 8104],
  invalidMeeting: 8999,
  users: { member: 8201, companion: 8202, owner: 8203, shop: 8204, admin: 8205, banned: 8208 },
  companions: { linked: 8701, unlinked: 8702 },
  disposable: { user: 8235, meeting: 8104, menu: 8437 },
} as const;

export const MOBILE_UX_PERSONAS = [
  { id: "P0", context: "public", userId: null },
  { id: "P1", context: "member", userId: 8201 },
  { id: "P2", context: "member", userId: 8202 },
  { id: "P3", context: "member", userId: 8203 },
  { id: "P4", context: "shop", userId: 8204 },
  { id: "P5", context: "kakao-admin-login", userId: 8205 },
  { id: "P6", context: "kakao-admin", userId: 8205 },
  { id: "P7", context: "password-admin", userId: null },
  { id: "P8", context: "banned", userId: 8208 },
] as const;

export const MOBILE_UX_FIXTURE_KEYS = ["D0", "E0", "L0", "X0"] as const;
export type MobileUxFixtureKey = (typeof MOBILE_UX_FIXTURE_KEYS)[number];

export type FixtureUser = {
  readonly id: number;
  readonly kakaoId: string;
  readonly name: string;
  readonly role: "ADMIN" | "SHOP_OWNER" | "MEMBER" | "BANNED";
  readonly memberType: "REGULAR" | "COMPANION";
};

export type FixtureMeeting = {
  readonly id: number;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly location: string;
  readonly description: string;
  readonly isOpen: boolean;
  readonly settlementOpen: boolean;
  readonly meetingType: string;
};

export type FixtureMenu = {
  readonly id: number;
  readonly categoryId: number;
  readonly name: string;
  readonly price: number;
  readonly optionGroupName: string | null;
  readonly isActive: boolean;
  readonly displayOrder: number;
};

export type FixtureVariant = {
  readonly id: number | null;
  readonly menuItemId: number;
  readonly label: string;
  readonly price: number;
  readonly displayOrder: number;
};

export type FixtureParticipant = {
  readonly id: number;
  readonly meetingId: number;
  readonly name: string;
  readonly kakaoId: string;
  readonly companionId: number | null;
  readonly status: "APPROVED" | "WAITLISTED" | "CANCELLED";
  readonly hasLesson: boolean;
  readonly hasBus: boolean;
  readonly hasRental: boolean;
};

export type FixtureOrderItem = {
  readonly id: number;
  readonly foodOrderId: number;
  readonly participantId: number;
  readonly menuItemId: number;
  readonly variantId: number | null;
  readonly quantity: number;
  readonly state: "ACTIVE" | "PREPARING" | "SERVED" | "CANCELLED";
};

export type MobileUxFixture = {
  readonly checksum: string;
  readonly seoulDate: string;
  readonly users: readonly FixtureUser[];
  readonly meetings: readonly FixtureMeeting[];
  readonly categories: readonly { readonly id: number; readonly name: string; readonly displayOrder: number }[];
  readonly menus: readonly FixtureMenu[];
  readonly variants: readonly FixtureVariant[];
  readonly companions: readonly { readonly id: number; readonly name: string; readonly ownerKakaoId: string; readonly linkedKakaoId: string | null }[];
  readonly participants: readonly FixtureParticipant[];
  readonly orderItems: readonly FixtureOrderItem[];
  readonly usageItems: readonly { readonly id: number; readonly name: string; readonly serviceType: string; readonly price: number }[];
  readonly usageSubmissions: readonly { readonly id: number; readonly participantId: number; readonly status: "SUBMITTED" | "CONFIRMED" }[];
  readonly orderStates: readonly string[];
  readonly usageStates: readonly string[];
  readonly settings: readonly { readonly key: string; readonly value: string }[];
};

export class MobileUxFixtureInputError extends Error {
  readonly name = "MobileUxFixtureInputError";
}

export function parseMobileUxFixtureKey(value: string): MobileUxFixtureKey {
  const key = MOBILE_UX_FIXTURE_KEYS.find((candidate) => candidate === value);
  if (!key) {
    throw new MobileUxFixtureInputError(`unknown mobile UX fixture key: ${value}`);
  }
  return key;
}

function shiftedDate(seoulDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(seoulDate);
  if (!match) {
    throw new MobileUxFixtureInputError("Seoul fixture date must use YYYY-MM-DD");
  }
  const base = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (base.toISOString().slice(0, 10) !== seoulDate) {
    throw new MobileUxFixtureInputError("Seoul fixture date is not a calendar date");
  }
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function fixtureUsers(): readonly FixtureUser[] {
  return Array.from({ length: 35 }, (_, offset): FixtureUser => {
    const number = offset + 1;
    const role = number === 4 ? "SHOP_OWNER" : number === 5 || number === 6 ? "ADMIN" : number === 8 ? "BANNED" : "MEMBER";
    return {
      id: 8200 + number,
      kakaoId: `qa-user-${String(number).padStart(2, "0")}`,
      name: number === 35 ? "합성 회원 이름이 매우 길어서 모바일 줄바꿈과 목록 밀도를 검증하는 서른다섯 번째 사용자" : `합성 회원 ${String(number).padStart(2, "0")}`,
      role,
      memberType: number === 2 ? "COMPANION" : "REGULAR",
    };
  });
}

function fixtureMenus(): readonly FixtureMenu[] {
  return Array.from({ length: 37 }, (_, offset) => ({
    id: 8401 + offset,
    categoryId: 8301 + (offset % 6),
    name: offset === 35 ? "바삭한 해변 모래처럼 고소한 초장문 합성 메뉴와 아주 긴 한글 설명용 이름" : `합성 메뉴 ${String(offset + 1).padStart(2, "0")}`,
    price: 4_000 + offset * 250,
    optionGroupName: offset < 12 ? "크기와 맵기 선택" : null,
    isActive: offset < 36,
    displayOrder: offset + 1,
  }));
}

function fixtureVariants(menus: readonly FixtureMenu[]): readonly FixtureVariant[] {
  let optionId = 8501;
  const variants: FixtureVariant[] = [];
  for (const menu of menus) {
    if (!menu.isActive) continue;
    if (menu.optionGroupName === null) {
      variants.push({ id: null, menuItemId: menu.id, label: "기본", price: menu.price, displayOrder: 0 });
      continue;
    }
    for (const [index, label] of ["작게", "보통", "푸짐하게"].entries()) {
      variants.push({ id: optionId, menuItemId: menu.id, label, price: menu.price + index * 500, displayOrder: index + 1 });
      optionId += 1;
    }
  }
  return variants;
}

function fixtureParticipants(users: readonly FixtureUser[]): readonly FixtureParticipant[] {
  const direct = users.map((user, index): FixtureParticipant => ({
    id: 8801 + index,
    meetingId: 8101,
    name: user.name,
    kakaoId: user.kakaoId,
    companionId: null,
    status: index >= 33 ? "CANCELLED" : index >= 30 ? "WAITLISTED" : "APPROVED",
    hasLesson: index % 3 === 0,
    hasBus: index % 2 === 0,
    hasRental: index % 4 === 0,
  }));
  return [
    ...direct,
    { id: 8836, meetingId: 8102, name: "연동된 합성 동반인", kakaoId: "qa-user-03", companionId: 8701, status: "APPROVED", hasLesson: true, hasBus: false, hasRental: true },
    { id: 8837, meetingId: 8102, name: "미연동 합성 동반인", kakaoId: "qa-user-03", companionId: 8702, status: "APPROVED", hasLesson: false, hasBus: true, hasRental: false },
    { id: 8838, meetingId: 8103, name: users[0]?.name ?? "합성 회원 01", kakaoId: "qa-user-01", companionId: null, status: "APPROVED", hasLesson: false, hasBus: false, hasRental: false },
  ];
}

function fixtureOrderItems(): readonly FixtureOrderItem[] {
  return [
    { id: 9001, foodOrderId: 8901, participantId: 8801, menuItemId: 8401, variantId: 8501, quantity: 2, state: "ACTIVE" },
    { id: 9002, foodOrderId: 8901, participantId: 8801, menuItemId: 8413, variantId: null, quantity: 1, state: "ACTIVE" },
    { id: 9003, foodOrderId: 8902, participantId: 8801, menuItemId: 8402, variantId: 8504, quantity: 3, state: "PREPARING" },
    { id: 9004, foodOrderId: 8903, participantId: 8802, menuItemId: 8403, variantId: 8507, quantity: 1, state: "CANCELLED" },
    { id: 9005, foodOrderId: 8903, participantId: 8802, menuItemId: 8414, variantId: null, quantity: 2, state: "ACTIVE" },
    { id: 9006, foodOrderId: 8904, participantId: 8803, menuItemId: 8415, variantId: null, quantity: 1, state: "SERVED" },
    { id: 9007, foodOrderId: 8905, participantId: 8804, menuItemId: 8416, variantId: null, quantity: 4, state: "CANCELLED" },
  ];
}

export function buildMobileUxFixture(seoulDate: string): MobileUxFixture {
  const users = fixtureUsers();
  const menus = fixtureMenus();
  const variants = fixtureVariants(menus);
  const data = {
    seoulDate,
    users,
    meetings: [
      { id: 8101, date: seoulDate, startTime: "09:30", endTime: "13:00", location: "합성 서핑 해변 A", description: "오늘 주문과 반복 제출을 검증하는 밀집 모임", isOpen: true, settlementOpen: true, meetingType: "정기" },
      { id: 8102, date: shiftedDate(seoulDate, 1), startTime: "10:00", endTime: "12:30", location: "합성 서핑 해변 B", description: "동반인 연동 상태를 검증하는 모임", isOpen: true, settlementOpen: false, meetingType: "정기" },
      { id: 8103, date: shiftedDate(seoulDate, -7), startTime: "08:00", endTime: "11:00", location: "합성 서핑 해변 C", description: "지난 주문과 정산 완료 상태를 검증하는 모임", isOpen: false, settlementOpen: true, meetingType: "비정기" },
      { id: 8104, date: shiftedDate(seoulDate, 14), startTime: "11:00", endTime: "12:00", location: "합성 빈 해변", description: "삭제 가능한 빈 상태 전용 모임", isOpen: true, settlementOpen: false, meetingType: "비정기" },
    ],
    categories: Array.from({ length: 6 }, (_, index) => ({ id: 8301 + index, name: index === 5 ? "아주 긴 한글 카테고리와 모바일 줄바꿈 검증" : `합성 카테고리 ${index + 1}`, displayOrder: index + 1 })),
    menus,
    variants,
    companions: [
      { id: 8701, name: "연동된 합성 동반인", ownerKakaoId: "qa-user-03", linkedKakaoId: "qa-user-02" },
      { id: 8702, name: "미연동 합성 동반인", ownerKakaoId: "qa-user-03", linkedKakaoId: null },
    ],
    participants: fixtureParticipants(users),
    orderItems: fixtureOrderItems(),
    usageItems: [
      { id: 9101, name: "합성 강습 패키지", serviceType: "LESSON", price: 50_000 },
      { id: 9102, name: "합성 장비 대여", serviceType: "RENTAL", price: 30_000 },
      { id: 9103, name: "아주 긴 한글 이름의 합성 추가 이용 항목", serviceType: "CUSTOM", price: 12_000 },
    ],
    usageSubmissions: [
      { id: 9201, participantId: 8801, status: "SUBMITTED" },
      { id: 9202, participantId: 8802, status: "CONFIRMED" },
    ],
    orderStates: ["ACTIVE", "PREPARING", "SERVED", "CANCELLED", "MIXED"],
    usageStates: ["MISSING", "SUBMITTED", "CONFIRMED"],
    settings: [
      { key: "food_order_support_cap", value: "10000" },
      { key: "cancellation_penalty_message", value: "합성 취소 안내 문구입니다." },
      { key: "participant_option_pricing_guide", value: "강습과 장비 대여의 합성 요금 안내입니다." },
      { key: "settlement_bank_name", value: "합성은행" },
      { key: "settlement_account_number", value: "000-0000-0000" },
      { key: "settlement_account_holder", value: "합성서핑클럽" },
    ],
  } satisfies Omit<MobileUxFixture, "checksum">;
  const checksum = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return { checksum, ...data };
}
