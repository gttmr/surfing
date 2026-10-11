import { headers } from "next/headers";
import { AdminBankDepositsPageClient } from "@/components/admin/AdminBankDepositsPageClient";
import { autoMatchPendingDeposits, getBankDepositDashboard } from "@/lib/bank-deposits";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

export default async function AdminDepositsPage() {
  await requireAdminPage();
  // 화면을 열 때마다 대기 중인 입금을 다시 대조한다(청구 공개 전에 먼저 입금한 경우 등).
  await autoMatchPendingDeposits();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  return (
    <AdminBankDepositsPageClient
      initialDashboard={await getBankDepositDashboard()}
      webhookEndpoint={`${protocol}://${host}/api/bank/deposits`}
    />
  );
}
