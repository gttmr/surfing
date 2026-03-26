import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) return NextResponse.json(null);
  return NextResponse.json(user);
}
