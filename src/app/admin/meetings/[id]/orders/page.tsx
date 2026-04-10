import { notFound } from "next/navigation";
import { AdminMeetingOrdersPageClient } from "@/components/admin/AdminMeetingOrdersPageClient";
import { getAdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";

export const dynamic = "force-dynamic";

export default async function AdminMeetingOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    notFound();
  }

  const data = await getAdminMeetingFoodOrdersData(meetingId);
  if (!data) {
    notFound();
  }

  return <AdminMeetingOrdersPageClient meetingId={meetingId} initialData={data} />;
}
