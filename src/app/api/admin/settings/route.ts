import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return NextResponse.json(map);
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const updates = body?.updates;

  if (updates && typeof updates === "object" && !Array.isArray(updates)) {
    const entries = Object.entries(updates).filter(([key, value]) => key && value !== undefined);

    if (entries.length === 0) {
      return NextResponse.json({ error: "업데이트할 설정이 없습니다" }, { status: 400 });
    }

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    return NextResponse.json({ ok: true });
  }

  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: "key와 value가 필요합니다" }, { status: 400 });
  }

  await prisma.setting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });

  return NextResponse.json({ ok: true });
}
