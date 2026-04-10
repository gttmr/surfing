import { AdminFoodMenuPageClient } from "@/components/admin/AdminFoodMenuPageClient";
import { getAdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

export const dynamic = "force-dynamic";

export default async function AdminMenusPage() {
  const initialData = await getAdminFoodMenuSettingsData();
  return <AdminFoodMenuPageClient initialData={initialData} />;
}
