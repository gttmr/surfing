import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
} from "@/lib/settings";

export async function GET() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [PARTICIPANT_OPTION_PRICING_GUIDE_KEY],
      },
    },
  });

  const map: Record<string, string> = {
    [PARTICIPANT_OPTION_PRICING_GUIDE_KEY]: DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  };

  for (const setting of settings) {
    map[setting.key] = setting.value;
  }

  return NextResponse.json(map);
}
