import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const linkedCompanion = await prisma.companion.findFirst({
    where: { linkedKakaoId: session.kakaoId },
    include: { owner: { select: { kakaoId: true, name: true } } },
  });

  if (!linkedCompanion) {
    return NextResponse.json({ linked: false });
  }

  return NextResponse.json({
    linked: true,
    companion: {
      id: linkedCompanion.id,
      name: linkedCompanion.name,
      owner: linkedCompanion.owner,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const ownerKakaoId = typeof body.ownerKakaoId === "string" ? body.ownerKakaoId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!ownerKakaoId || !name) {
    return NextResponse.json({ error: "정회원과 이름이 필요합니다" }, { status: 400 });
  }

  const owner = await prisma.user.findUnique({
    where: { kakaoId: ownerKakaoId },
    select: { kakaoId: true, memberType: true },
  });

  if (!owner || owner.memberType !== "REGULAR") {
    return NextResponse.json({ error: "유효한 정회원을 선택해주세요" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentLinks = await tx.companion.findMany({
      where: { linkedKakaoId: session.kakaoId },
      select: { id: true },
    });

    let target = await tx.companion.findFirst({
      where: {
        ownerKakaoId,
        linkedKakaoId: session.kakaoId,
      },
    });

    if (!target) {
      target = await tx.companion.findFirst({
        where: {
          ownerKakaoId,
          linkedKakaoId: null,
          name,
        },
      });
    }

    if (target) {
      target = await tx.companion.update({
        where: { id: target.id },
        data: {
          linkedKakaoId: session.kakaoId,
          name,
        },
      });
    } else {
      target = await tx.companion.create({
        data: {
          ownerKakaoId,
          linkedKakaoId: session.kakaoId,
          name,
        },
      });
    }

    const staleIds = currentLinks.map((item) => item.id).filter((id) => id !== target!.id);
    if (staleIds.length) {
      await tx.companion.updateMany({
        where: { id: { in: staleIds } },
        data: { linkedKakaoId: null },
      });
    }

    return tx.companion.findUnique({
      where: { id: target.id },
      include: { owner: { select: { kakaoId: true, name: true } } },
    });
  });

  return NextResponse.json({
    linked: true,
    companion: {
      id: result?.id,
      name: result?.name,
      owner: result?.owner,
    },
  });
}
