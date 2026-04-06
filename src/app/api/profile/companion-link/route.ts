import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const linkedCompanion = await prisma.companion.findFirst({
    where: { linkedKakaoId: session.kakaoId, archivedAt: null },
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
  const companionId = Number(body.companionId);

  if (!Number.isInteger(companionId)) {
    return NextResponse.json({ error: "연결할 동반인을 선택해주세요" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentLinks = await tx.companion.findMany({
        where: { linkedKakaoId: session.kakaoId, archivedAt: null },
        select: { id: true },
      });

      const target = await tx.companion.findUnique({
        where: { id: companionId },
        include: {
          owner: {
            select: { kakaoId: true, name: true, memberType: true },
          },
        },
      });

      if (!target || target.archivedAt) {
        throw new Error("COMPANION_NOT_FOUND");
      }

      if (target.owner.memberType !== "REGULAR") {
        throw new Error("INVALID_OWNER");
      }

      if (target.linkedKakaoId && target.linkedKakaoId !== session.kakaoId) {
        throw new Error("ALREADY_LINKED");
      }

      await tx.companion.update({
        where: { id: target.id },
        data: {
          linkedKakaoId: session.kakaoId,
          archivedAt: null,
        },
      });

      const staleIds = currentLinks.map((item) => item.id).filter((id) => id !== target.id);
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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "COMPANION_NOT_FOUND") {
        return NextResponse.json({ error: "연결할 동반인을 찾을 수 없습니다" }, { status: 404 });
      }
      if (error.message === "INVALID_OWNER") {
        return NextResponse.json({ error: "유효한 정회원의 동반인만 연결할 수 있습니다" }, { status: 400 });
      }
      if (error.message === "ALREADY_LINKED") {
        return NextResponse.json({ error: "이미 다른 계정과 연동된 동반인입니다" }, { status: 409 });
      }
    }

    console.error("Failed to link companion from profile", error);
    return NextResponse.json({ error: "동반인 연결에 실패했습니다" }, { status: 500 });
  }
}
