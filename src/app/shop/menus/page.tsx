import { ShopMenusPageClient } from "@/components/shop/ShopMenusPageClient";
import { getAdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

export const dynamic = "force-dynamic";

export default async function ShopMenusPage() {
  const initialData = await getAdminFoodMenuSettingsData();
  return <ShopMenusPageClient initialData={initialData} />;
}
