import { notFound } from "next/navigation";
import { AdminMeetingSettlementPageClient } from "@/components/admin/AdminMeetingSettlementPageClient";
import { getAdminSettlementData } from "@/lib/admin-page-data";

export default async function AdminMeetingSettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetingId = Number(id);

  if (!Number.isInteger(meetingId)) {
    notFound();
  }

  const data = await getAdminSettlementData(meetingId);
  if (!data) {
    notFound();
  }

  return <AdminMeetingSettlementPageClient meetingId={meetingId} initialData={data} />;
}
