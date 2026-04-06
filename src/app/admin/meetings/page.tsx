import { AdminMeetingsPageClient } from "@/components/admin/AdminMeetingsPageClient";
import { getAdminMeetings } from "@/lib/admin-page-data";

export default async function AdminMeetingsPage() {
  const initialMeetings = await getAdminMeetings();
  return <AdminMeetingsPageClient initialMeetings={initialMeetings} />;
}
