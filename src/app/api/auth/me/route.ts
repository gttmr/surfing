import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionFromRequest } from "@/lib/active-session";

export async function GET(req: NextRequest) {
  const user = await getActiveSessionFromRequest(req);
  if (!user) return NextResponse.json(null);
  return NextResponse.json(user);
}
