import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import {
  getFoodMenus,
  getParticipantMeetingFoodOrdersData,
} from "@/lib/food-ordering-data";
import {
  getFoodOrderParticipantAccess,
  isMeetingOrderOpen,
  normalizeFoodOrderPayload,
} from "@/lib/food-ordering";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임입니다." }, { status: 400 });
  }

  const data = await getParticipantMeetingFoodOrdersData(meetingId, session.kakaoId);
  if (!data) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임입니다." }, { status: 400 });
  }

  const body = await req.json();
  const participantId = Number(body?.participantId);
  const items = Array.isArray(body?.items) ? body.items : null;

  if (!Number.isInteger(participantId) || !items) {
    return NextResponse.json({ error: "participantId와 items가 필요합니다." }, { status: 400 });
  }

  const [meeting, participant, menus] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, date: true },
    }),
    prisma.participant.findFirst({
      where: {
        id: participantId,
        meetingId,
        status: "APPROVED",
      },
      select: {
        id: true,
        kakaoId: true,
        companionId: true,
        companion: {
          select: {
            ownerKakaoId: true,
            linkedKakaoId: true,
          },
        },
      },
    }),
    getFoodMenus(),
  ]);

  if (!meeting) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!participant) {
    return NextResponse.json({ error: "주문 권한이 없습니다." }, { status: 403 });
  }

  const access = getFoodOrderParticipantAccess({
    sessionKakaoId: session.kakaoId,
    participantKakaoId: participant.kakaoId,
    companionId: participant.companionId,
    companionOwnerKakaoId: participant.companion?.ownerKakaoId ?? null,
    companionLinkedKakaoId: participant.companion?.linkedKakaoId ?? null,
  });

  if (!access.canOrder) {
    return NextResponse.json({ error: access.lockedReason ?? "주문 권한이 없습니다." }, { status: 403 });
  }

  if (!isMeetingOrderOpen(meeting.date)) {
    return NextResponse.json({ error: "주문은 모임 당일에만 받을 수 있습니다." }, { status: 400 });
  }

  let normalizedItems;
  try {
    normalizedItems = normalizeFoodOrderPayload(items, menus);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "주문을 저장할 수 없습니다." },
      { status: 400 }
    );
  }

  const itemsToCreate = normalizedItems.filter((item) => item.quantity > 0);

  if (itemsToCreate.length === 0) {
    return NextResponse.json({ error: "주문할 메뉴를 선택해 주세요." }, { status: 400 });
  }

  const menuMap = new Map(menus.map((menu) => [menu.id, menu]));
  const optionMap = new Map(
    menus.flatMap((menu) => menu.options.map((option) => [option.id, { menu, option }] as const))
  );

  await prisma.participantFoodOrder.create({
    data: {
      meetingId,
      participantId,
      items: {
        create: itemsToCreate.map((item) => {
          const menu = menuMap.get(item.menuItemId);
          if (!menu) throw new Error("판매 중인 메뉴만 주문할 수 있습니다.");
          const option = item.optionChoiceId === null ? null : optionMap.get(item.optionChoiceId)?.option ?? null;
          return {
            meetingId,
            participantId,
            menuItemId: item.menuItemId,
            menuOptionChoiceId: option?.id ?? null,
            menuNameSnapshot: menu.name,
            optionGroupNameSnapshot: option ? menu.optionGroupName : null,
            optionChoiceLabelSnapshot: option?.label ?? null,
            unitPriceSnapshot: option?.price ?? menu.price,
            quantity: item.quantity,
          };
        }),
      },
    },
  });

  const data = await getParticipantMeetingFoodOrdersData(meetingId, session.kakaoId);
  return NextResponse.json(data);
}
