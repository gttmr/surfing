import { AdminMessagesPageClient } from "@/components/admin/AdminMessagesPageClient";
import { getAdminNotices, getAdminSettingsMap } from "@/lib/admin-page-data";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
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
