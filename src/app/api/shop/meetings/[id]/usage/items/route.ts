import { NextRequest, NextResponse } from "next/server";
import { canAccessShopPortalFromRequest } from "@/lib/auth";
import {
  getShopMeetingSurfUsageData,
  saveShopSurfUsageCatalog,
} from "@/lib/surf-usage-data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canAccessShopPortalFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임입니다." }, { status: 400 });
  }

  const body = await req.json();

  try {
    await saveShopSurfUsageCatalog(body?.items);
    const data = await getShopMeetingSurfUsageData(meetingId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이용 항목을 저장하지 못했습니다." },
      { status: 400 }
    );
  }
}
