import { AdminPricingPageClient } from "@/components/admin/AdminPricingPageClient";
import { getAdminPricingState } from "@/lib/admin-page-data";

export default async function AdminPricingPage() {
  const initialPricing = await getAdminPricingState();
  return <AdminPricingPageClient initialPricing={initialPricing} />;
}
