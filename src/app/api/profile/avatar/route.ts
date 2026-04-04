import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withResolvedProfileImage } from "@/lib/profile-image";
import { getSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 1024 * 1024;

function extensionFor(contentType: string) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    default:
      return "webp";
  }
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Vercel Blob이 설정되지 않았습니다." }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "JPG, PNG, WebP만 업로드할 수 있습니다." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "압축 후 1MB 이하 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { kakaoId: session.kakaoId },
    select: {
      customProfileImageUrl: true,
    },
  });

  const pathname = `profiles/${session.kakaoId}/${Date.now()}.${extensionFor(file.type)}`;
  const uploaded = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  const user = await prisma.user.update({
    where: { kakaoId: session.kakaoId },
    data: {
      customProfileImageUrl: uploaded.url,
    },
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  if (existing?.customProfileImageUrl) {
    void del(existing.customProfileImageUrl).catch((error) => {
      console.error("Failed to delete previous custom profile image", error);
    });
  }

  return NextResponse.json({
    uploaded,
    user: withResolvedProfileImage(user),
  });
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const existing = await prisma.user.findUnique({
    where: { kakaoId: session.kakaoId },
    select: {
      customProfileImageUrl: true,
    },
  });

  const user = await prisma.user.update({
    where: { kakaoId: session.kakaoId },
    data: {
      customProfileImageUrl: null,
    },
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  if (process.env.BLOB_READ_WRITE_TOKEN && existing?.customProfileImageUrl) {
    void del(existing.customProfileImageUrl).catch((error) => {
      console.error("Failed to delete custom profile image", error);
    });
  }

  return NextResponse.json({
    user: withResolvedProfileImage(user),
  });
}
