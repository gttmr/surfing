import { AdminMembersPageClient } from "@/components/admin/AdminMembersPageClient";
import { getAdminMembers } from "@/lib/admin-page-data";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  await requireAdminPage();
  const initialUsers = await getAdminMembers();
  return <AdminMembersPageClient initialUsers={initialUsers} />;
}
