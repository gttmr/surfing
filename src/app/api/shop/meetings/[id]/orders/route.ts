import { NextRequest, NextResponse } from "next/server";
import { canAccessShopPortalFromRequest } from "@/lib/auth";
import { getAdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import { handleFulfillmentOrderPatch } from "@/lib/fulfillment-order-route";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canAccessShopPortalFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임입니다." }, { status: 400 });
  }

  const data = await getAdminMeetingFoodOrdersData(meetingId);
  if (!data) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleFulfillmentOrderPatch({
    request: req,
    meetingId: Number(id),
    authorized: await canAccessShopPortalFromRequest(req),
  });
}
