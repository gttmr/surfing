import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

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

  return NextResponse.json(user);
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
