import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetingId = Number.parseInt(id, 10);

  if (Number.isNaN(meetingId)) {
    notFound();
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { date: true },
  });

  if (!meeting) {
    notFound();
  }

  redirect(`/?date=${encodeURIComponent(meeting.date)}`);
}
