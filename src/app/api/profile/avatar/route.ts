import { mkdir, unlink, writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { withResolvedProfileImage } from "@/lib/profile-image";
import { getSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 1024 * 1024;

type BlobUploadResult = {
  pathname: string;
  url: string;
};

type BlobApi = {
  put: (
    pathname: string,
    body: File,
    options: {
      access: "public";
      addRandomSuffix: boolean;
      contentType: string;
    },
  ) => Promise<BlobUploadResult>;
  del: (url: string) => Promise<void>;
};

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

function isLocalUploadUrl(url: string) {
  return url.startsWith("/uploads/");
}

async function deleteLocalUpload(url: string) {
  if (!isLocalUploadUrl(url)) return;
  const relativePath = url.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), "public", relativePath);
  await unlink(filePath).catch(() => {});
}

async function saveLocalUpload(kakaoId: string, file: File) {
  const relativeDir = path.join("uploads", "profiles", kakaoId);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });

  const filename = `${Date.now()}.${extensionFor(file.type)}`;
  const absolutePath = path.join(absoluteDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    pathname: `${relativeDir}/${filename}`.replace(/\\/g, "/"),
    url: `/${relativeDir}/${filename}`.replace(/\\/g, "/"),
  };
}

async function loadBlobApi(): Promise<BlobApi> {
  return (0, eval)('import("@vercel/blob")') as Promise<BlobApi>;
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "파일 데이터를 읽을 수 없습니다." }, { status: 400 });
  }

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

  try {
    const existing = await prisma.user.findUnique({
      where: { kakaoId: session.kakaoId },
      select: {
        customProfileImageUrl: true,
      },
    });

    const uploaded = process.env.BLOB_READ_WRITE_TOKEN
      ? await (async () => {
          const { put } = await loadBlobApi();
          return put(`profiles/${session.kakaoId}/${Date.now()}.${extensionFor(file.type)}`, file, {
            access: "public",
            addRandomSuffix: false,
            contentType: file.type,
          });
        })()
      : await saveLocalUpload(session.kakaoId, file);

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
      const existingImageUrl = existing.customProfileImageUrl;

      if (isLocalUploadUrl(existing.customProfileImageUrl)) {
        void deleteLocalUpload(existing.customProfileImageUrl).catch((error) => {
          console.error("Failed to delete previous local profile image", error);
        });
      } else if (process.env.BLOB_READ_WRITE_TOKEN) {
        void loadBlobApi()
          .then(({ del }) => del(existingImageUrl))
          .catch((error) => {
            console.error("Failed to delete previous custom profile image", error);
          });
      }
    }

    return NextResponse.json({
      uploaded,
      user: withResolvedProfileImage(user),
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: "업로드에 실패했습니다. 다시 시도해주세요." }, { status: 500 });
  }
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

  if (existing?.customProfileImageUrl) {
    const existingImageUrl = existing.customProfileImageUrl;

    if (isLocalUploadUrl(existing.customProfileImageUrl)) {
      void deleteLocalUpload(existing.customProfileImageUrl).catch((error) => {
        console.error("Failed to delete local profile image", error);
      });
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      void loadBlobApi()
        .then(({ del }) => del(existingImageUrl))
        .catch((error) => {
          console.error("Failed to delete custom profile image", error);
        });
    }
  }

  return NextResponse.json({
    user: withResolvedProfileImage(user),
  });
}
