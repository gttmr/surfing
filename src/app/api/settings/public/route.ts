import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
  DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
  DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
  DEFAULT_SETTLEMENT_BANK_NAME,
  SETTLEMENT_ACCOUNT_HOLDER_KEY,
  SETTLEMENT_ACCOUNT_NUMBER_KEY,
  SETTLEMENT_BANK_NAME_KEY,
} from "@/lib/settings";

export async function GET() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
          SETTLEMENT_BANK_NAME_KEY,
          SETTLEMENT_ACCOUNT_NUMBER_KEY,
          SETTLEMENT_ACCOUNT_HOLDER_KEY,
        ],
      },
    },
  });

  const map: Record<string, string> = {
    [PARTICIPANT_OPTION_PRICING_GUIDE_KEY]: DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
    [SETTLEMENT_BANK_NAME_KEY]: DEFAULT_SETTLEMENT_BANK_NAME,
    [SETTLEMENT_ACCOUNT_NUMBER_KEY]: DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
    [SETTLEMENT_ACCOUNT_HOLDER_KEY]: DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
  };

  for (const setting of settings) {
    map[setting.key] = setting.value;
  }

  return NextResponse.json(map);
}
