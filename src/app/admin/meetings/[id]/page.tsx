import { notFound } from "next/navigation";
import { AdminMeetingDetailPageClient } from "@/components/admin/AdminMeetingDetailPageClient";
import { getAdminMeetingDetail } from "@/lib/admin-page-data";
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

  if (!Number.isInteger(meetingId)) {
    notFound();
  }

  const meeting = await getAdminMeetingDetail(meetingId);
  if (!meeting) {
    notFound();
  }

  return <AdminMeetingDetailPageClient meetingId={meetingId} initialMeeting={meeting} />;
}
