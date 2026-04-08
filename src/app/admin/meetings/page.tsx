import { AdminMeetingsPageClient } from "@/components/admin/AdminMeetingsPageClient";
import { getAdminMeetings } from "@/lib/admin-page-data";

export const dynamic = "force-dynamic";

export default async function AdminMeetingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ create?: string; date?: string; type?: string }>;
}) {
  const initialMeetings = await getAdminMeetings();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialCreateDate = resolvedSearchParams?.date ?? "";
  const initialCreateType = resolvedSearchParams?.type === "비정기" ? "비정기" : "정기";
  const initialShowCreate = resolvedSearchParams?.create === "1";

  return (
    <AdminMeetingsPageClient
      initialCreateDate={initialCreateDate}
      initialCreateType={initialCreateType}
      initialMeetings={initialMeetings}
      initialShowCreate={initialShowCreate}
    />
  );
}
