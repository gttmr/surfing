import { AdminMeetingsPageClient } from "@/components/admin/AdminMeetingsPageClient";
import { getAdminMeetings } from "@/lib/admin-page-data";
import { requireAdminPage } from "@/lib/require-admin-page";
import { prisma } from "@/lib/db";
import { getPricingConfig } from "@/lib/pricing";
import { OVERNIGHT_DAY2_FEE_DEFAULT } from "@/lib/meeting-days";
import { PRICING_SETTING_KEYS } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminMeetingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ create?: string; date?: string; type?: string }>;
}) {
  await requireAdminPage();
  const [initialMeetings, pricing, lastOvernightMeeting] = await Promise.all([
    getAdminMeetings(),
    getPricingConfig(),
    prisma.meeting.findFirst({
      where: { endDate: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { lodgingFee: true },
    }),
  ]);
  const overnightFeeDefaults = {
    regularDayFee: pricing[PRICING_SETTING_KEYS.regularBaseFee],
    companionDayFee: pricing[PRICING_SETTING_KEYS.companionBaseFee],
    day2Fee: OVERNIGHT_DAY2_FEE_DEFAULT,
    lodgingFee: lastOvernightMeeting?.lodgingFee ?? 0,
  };
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialCreateDate = resolvedSearchParams?.date ?? "";
  const initialCreateType = resolvedSearchParams?.type === "비정기" ? "비정기" : "정기";
  const initialShowCreate = resolvedSearchParams?.create === "1";

  return (
    <AdminMeetingsPageClient
      initialCreateDate={initialCreateDate}
      initialCreateType={initialCreateType}
      initialMeetings={initialMeetings}
      initialShowCreate={initialShowCreate}
      overnightFeeDefaults={overnightFeeDefaults}
    />
  );
}
