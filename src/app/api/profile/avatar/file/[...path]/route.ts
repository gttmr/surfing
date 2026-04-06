import { NextResponse } from "next/server";
import { readGcsProfileImage } from "@/lib/profile-image-storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const objectName = path?.join("/");

  if (!objectName) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const image = await readGcsProfileImage(objectName);
    if (!image) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return new NextResponse(new Uint8Array(image.buffer), {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": image.cacheControl,
        ...(image.etag ? { ETag: image.etag } : {}),
      },
    });
  } catch (error) {
    console.error("Failed to read profile image from GCS", error);
    return new NextResponse("Not Found", { status: 404 });
  }
}
