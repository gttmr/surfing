import { AdminSettingsPageClient } from "@/components/admin/AdminSettingsPageClient";
import { getAdminSettingsFormData } from "@/lib/admin-page-data";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const initialSettings = await getAdminSettingsFormData();
  return <AdminSettingsPageClient initialSettings={initialSettings} />;
}
