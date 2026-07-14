import { AdminMessagesPageClient } from "@/components/admin/AdminMessagesPageClient";
import { getAdminNotices, getAdminSettingsMap } from "@/lib/admin-page-data";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  await requireAdminPage();
  const [initialNotices, initialSettings] = await Promise.all([
    getAdminNotices(),
    getAdminSettingsMap(),
  ]);

  return (
    <AdminMessagesPageClient
      initialNotices={initialNotices}
      initialSettings={initialSettings}
    />
  );
}
