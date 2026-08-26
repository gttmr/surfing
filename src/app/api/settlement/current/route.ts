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
    return NextResponse.json({ billing: [], pending: [] });
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
  const legacyAccount = {
    bankName: settingsMap.get(SETTLEMENT_BANK_NAME_KEY) ?? "",
    accountNumber: settingsMap.get(SETTLEMENT_ACCOUNT_NUMBER_KEY) ?? "",
    accountHolder: settingsMap.get(SETTLEMENT_ACCOUNT_HOLDER_KEY) ?? "",
  };
  const billing = settlements.map((settlement) => ({
    ...settlement,
    settlementAccount: settlement.publicationRevision === null
      ? legacyAccount
      : settlement.settlementAccount,
  }));
  const pending = billing.filter(
    (settlement) => settlement.paymentStatus === "PAYMENT_REQUIRED" || settlement.paymentStatus === "REPORTED"
  );
  return NextResponse.json({
    billing,
    pending,
    settlementAccount: legacyAccount,
  });
}
