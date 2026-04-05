import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { withResolvedProfileImage } from "@/lib/profile-image";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = parseInt(id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      participants: {
        include: { meeting: { select: { date: true, location: true, startTime: true } } },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(withResolvedProfileImage(user));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { role, phoneNumber, penaltyCount, memberType } = body;

  const user = await prisma.user.update({
    where: { id: parseInt(id) },
    data: {
      ...(role && { role }),
      ...(memberType && { memberType }),
      ...(phoneNumber !== undefined && { phoneNumber: phoneNumber || null }),
      ...(penaltyCount !== undefined && { penaltyCount: parseInt(penaltyCount) }),
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = parseInt(id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, kakaoId: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const ownedCompanions = await tx.companion.findMany({
      where: { ownerKakaoId: user.kakaoId },
      select: { id: true },
    });
    const linkedCompanions = await tx.companion.findMany({
      where: { linkedKakaoId: user.kakaoId },
      select: { id: true },
    });
    const companionIdsToDelete = Array.from(
      new Set([...ownedCompanions, ...linkedCompanions].map((companion) => companion.id))
    );

    if (companionIdsToDelete.length) {
      await tx.participant.deleteMany({
        where: {
          companionId: { in: companionIdsToDelete },
        },
      });

      await tx.companion.deleteMany({
        where: {
          id: { in: companionIdsToDelete },
        },
      });
    }

    await tx.participant.deleteMany({
      where: { kakaoId: user.kakaoId },
    });

    await tx.companion.updateMany({
      where: { linkedKakaoId: user.kakaoId },
      data: { linkedKakaoId: null },
    });

    await tx.settlementConfirmation.deleteMany({
      where: { recipientKakaoId: user.kakaoId },
    });

    await tx.deletedKakaoId.create({
      data: { kakaoId: user.kakaoId },
    });

    await tx.user.delete({
      where: { id: user.id },
    });
  });

  return NextResponse.json({ ok: true });
}
