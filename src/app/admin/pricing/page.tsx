import { AdminPricingPageClient } from "@/components/admin/AdminPricingPageClient";
import { getAdminPricingState } from "@/lib/admin-page-data";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  await requireAdminPage();
  const initialPricing = await getAdminPricingState();
  return <AdminPricingPageClient initialPricing={initialPricing} />;
}
