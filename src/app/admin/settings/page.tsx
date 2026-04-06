import { AdminSettingsPageClient } from "@/components/admin/AdminSettingsPageClient";
import { getAdminSettingsFormData } from "@/lib/admin-page-data";

export default async function AdminSettingsPage() {
  const initialSettings = await getAdminSettingsFormData();
  return <AdminSettingsPageClient initialSettings={initialSettings} />;
}
