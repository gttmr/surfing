import { AdminFoodMenuPageClient } from "@/components/admin/AdminFoodMenuPageClient";
import { getAdminFoodMenuSettingsData } from "@/lib/food-ordering-data";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

export default async function AdminMenusPage() {
  await requireAdminPage();
  const initialData = await getAdminFoodMenuSettingsData();
  return <AdminFoodMenuPageClient initialData={initialData} />;
}
