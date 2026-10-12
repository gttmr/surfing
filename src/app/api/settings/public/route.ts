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
  DEFAULT_PRICING_SETTINGS,
  PRICING_SETTING_KEYS,
} from "@/lib/settings";
import { getSurfUsageItems } from "@/lib/surf-usage-data";

export async function GET() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
          SETTLEMENT_BANK_NAME_KEY,
          SETTLEMENT_ACCOUNT_NUMBER_KEY,
          SETTLEMENT_ACCOUNT_HOLDER_KEY,
          ...Object.values(PRICING_SETTING_KEYS),
        ],
      },
    },
  });

  const map: Record<string, string> = {
    [PARTICIPANT_OPTION_PRICING_GUIDE_KEY]: DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
    [SETTLEMENT_BANK_NAME_KEY]: DEFAULT_SETTLEMENT_BANK_NAME,
    [SETTLEMENT_ACCOUNT_NUMBER_KEY]: DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
    [SETTLEMENT_ACCOUNT_HOLDER_KEY]: DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
    ...DEFAULT_PRICING_SETTINGS,
  };

  for (const setting of settings) {
    map[setting.key] = setting.value;
  }

  // 신청 화면의 강습·장비 예상 금액은 이용 항목표 가격을 쓴다.
  const usageItems = (await getSurfUsageItems()).map((item) => ({
    serviceType: item.serviceType,
    shopPrice: item.shopPrice,
    regularPrice: item.regularPrice,
    isActive: item.isActive,
  }));

  return NextResponse.json({ ...map, usageItems });
}
