import { notFound } from "next/navigation";
import { AdminMeetingDetailPageClient } from "@/components/admin/AdminMeetingDetailPageClient";
import { getAdminMeetingDetail, getAdminSettlementData } from "@/lib/admin-page-data";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

export default async function AdminMeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const meetingId = Number(id);

  if (!/^\d+$/.test(id) || !Number.isSafeInteger(meetingId) || meetingId < 1) {
    notFound();
  }

  const [meeting, operations] = await Promise.all([
    getAdminMeetingDetail(meetingId),
    getAdminSettlementData(meetingId),
  ]);
  if (!meeting || !operations) {
    notFound();
  }

  return <AdminMeetingDetailPageClient meetingId={meetingId} initialMeeting={meeting} initialOperations={operations} />;
}
