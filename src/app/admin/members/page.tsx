import { AdminMembersPageClient } from "@/components/admin/AdminMembersPageClient";
import { getAdminMembers } from "@/lib/admin-page-data";

export default async function AdminMembersPage() {
  const initialUsers = await getAdminMembers();
  return <AdminMembersPageClient initialUsers={initialUsers} />;
}
