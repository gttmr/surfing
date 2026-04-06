import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { getSettlementGroupsForKakaoId } from "@/lib/settlement";
import {
  SETTLEMENT_ACCOUNT_HOLDER_KEY,
  SETTLEMENT_ACCOUNT_NUMBER_KEY,
  SETTLEMENT_BANK_NAME_KEY,
} from "@/lib/settings";

export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ pending: [] });
  }

  const settlements = await getSettlementGroupsForKakaoId(session.kakaoId);
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          SETTLEMENT_BANK_NAME_KEY,
          SETTLEMENT_ACCOUNT_NUMBER_KEY,
          SETTLEMENT_ACCOUNT_HOLDER_KEY,
        ],
      },
    },
  });
  const settingsMap = new Map(settings.map((item) => [item.key, item.value]));
  return NextResponse.json({
    pending: settlements.filter((item) => !item.isConfirmed),
    settlementAccount: {
      bankName: settingsMap.get(SETTLEMENT_BANK_NAME_KEY) ?? "",
      accountNumber: settingsMap.get(SETTLEMENT_ACCOUNT_NUMBER_KEY) ?? "",
      accountHolder: settingsMap.get(SETTLEMENT_ACCOUNT_HOLDER_KEY) ?? "",
    },
  });
}
