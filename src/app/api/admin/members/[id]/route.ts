import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getAdminMemberProtectionCode,
  parseAdminMemberId,
  parseAdminMemberUpdate,
} from "@/lib/admin-members";
import { prisma } from "@/lib/db";
import { withResolvedProfileImage } from "@/lib/profile-image";
import { getSessionPayloadFromRequest } from "@/lib/session";
import { runSerializableTransaction } from "@/lib/transaction";

type ProtectionCode = "SELF_ADMIN_PROTECTED" | "LAST_ADMIN_PROTECTED";

class AdminMemberProtectionError extends Error {
  readonly name = "AdminMemberProtectionError";

  constructor(readonly code: ProtectionCode) {
    super(code);
  }
}

function protectionResponse(error: AdminMemberProtectionError) {
  const status = error.code === "SELF_ADMIN_PROTECTED" ? 403 : 409;
  return NextResponse.json({ code: error.code }, { status });
}

async function identifiedAdmin(
  transaction: Prisma.TransactionClient,
  kakaoId: string | null,
) {
  if (!kakaoId) return null;
  return transaction.user.findUnique({
    where: { kakaoId },
    select: { id: true, role: true },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseAdminMemberId((await params).id);
  if (userId === null) return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
  void request;
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
  request: NextRequest,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseAdminMemberId((await params).id);
  if (userId === null) return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
  const body: unknown = await request.json().then((value: unknown) => value, () => null);
  const parsed = parseAdminMemberUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });
  const session = getSessionPayloadFromRequest(request);
  const actorKakaoId = typeof session?.kakaoId === "string" ? session.kakaoId : null;

  try {
    const user = await runSerializableTransaction(async (transaction) => {
      const [existing, actor, adminCount] = await Promise.all([
        transaction.user.findUnique({
          where: { id: userId },
          select: { id: true, kakaoId: true, role: true, memberType: true },
        }),
        identifiedAdmin(transaction, actorKakaoId),
        transaction.user.count({ where: { role: "ADMIN" } }),
      ]);
      if (!existing) return null;
      const protection = getAdminMemberProtectionCode({
        action: "update",
        actorId: actor?.id ?? null,
        actorRole: actor?.role ?? null,
        targetId: existing.id,
        targetRole: existing.role,
        nextRole: parsed.value.role,
        adminCount,
      });
      if (protection) throw new AdminMemberProtectionError(protection);

      const updated = await transaction.user.update({
        where: { id: userId },
        data: parsed.value,
      });
      if (existing.memberType === "COMPANION" && parsed.value.memberType === "REGULAR") {
        await transaction.companion.updateMany({
          where: { linkedKakaoId: existing.kakaoId, archivedAt: null },
          data: { linkedKakaoId: null, archivedAt: new Date() },
        });
      }
      return updated;
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AdminMemberProtectionError) return protectionResponse(error);
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseAdminMemberId((await params).id);
  if (userId === null) return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
  const session = getSessionPayloadFromRequest(request);
  const actorKakaoId = typeof session?.kakaoId === "string" ? session.kakaoId : null;

  try {
    const deleted = await runSerializableTransaction(async (transaction) => {
      const [user, actor, adminCount] = await Promise.all([
        transaction.user.findUnique({ where: { id: userId }, select: { id: true, kakaoId: true, role: true } }),
        identifiedAdmin(transaction, actorKakaoId),
        transaction.user.count({ where: { role: "ADMIN" } }),
      ]);
      if (!user) return false;
      const protection = getAdminMemberProtectionCode({
        action: "delete",
        actorId: actor?.id ?? null,
        actorRole: actor?.role ?? null,
        targetId: user.id,
        targetRole: user.role,
        adminCount,
      });
      if (protection) throw new AdminMemberProtectionError(protection);

      const companions = await transaction.companion.findMany({
        where: { OR: [{ ownerKakaoId: user.kakaoId }, { linkedKakaoId: user.kakaoId }] },
        select: { id: true },
      });
      const companionIds = companions.map((companion) => companion.id);
      if (companionIds.length > 0) {
        await transaction.participant.deleteMany({ where: { companionId: { in: companionIds } } });
        await transaction.companion.deleteMany({ where: { id: { in: companionIds } } });
      }
      await transaction.participant.deleteMany({ where: { kakaoId: user.kakaoId } });
      await transaction.companion.updateMany({ where: { linkedKakaoId: user.kakaoId }, data: { linkedKakaoId: null } });
      await transaction.settlementConfirmation.deleteMany({ where: { recipientKakaoId: user.kakaoId } });
      await transaction.deletedKakaoId.upsert({
        where: { kakaoId: user.kakaoId },
        update: {},
        create: { kakaoId: user.kakaoId },
      });
      await transaction.user.delete({ where: { id: user.id } });
      return true;
    });
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminMemberProtectionError) return protectionResponse(error);
    throw error;
  }
}
