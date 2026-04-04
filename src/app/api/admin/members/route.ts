import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { withResolvedProfileImage } from "@/lib/profile-image";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  return NextResponse.json(users.map((user) => withResolvedProfileImage(user)));
}
