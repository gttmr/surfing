import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveProfileImage } from "@/lib/profile-image";
import SurfClubLandingPage from "@/components/landing/SurfClubLandingPage";

export default async function SchedulePageContent({
  initialSelectedDate = null,
}: {
  initialSelectedDate?: string | null;
}) {
  const sessionUser = await getSession();
  let isAdmin = false;
  let dbUnavailable = false;
  let userForClient = sessionUser
    ? {
        kakaoId: sessionUser.kakaoId,
        nickname: sessionUser.nickname,
        profileImage: sessionUser.profileImage,
      }
    : null;
  let meetingsForClient: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string | null;
    isOpen: boolean;
    meetingType: string;
    createdByKakaoId: string | null;
    approvedCount: number;
  }[] = [];
  let pinnedNotice: { title: string; body: string; updatedAt: string } | null = null;

  try {
    const dbUser = sessionUser
      ? await prisma.user.findUnique({
          where: { kakaoId: sessionUser.kakaoId },
          select: {
            role: true,
            name: true,
            profileImage: true,
            customProfileImageUrl: true,
          },
        })
      : null;

    isAdmin = dbUser?.role === "ADMIN";

    if (sessionUser && dbUser) {
      userForClient = {
        kakaoId: sessionUser.kakaoId,
        nickname: dbUser.name || sessionUser.nickname,
        profileImage: resolveProfileImage(dbUser) ?? sessionUser.profileImage,
      };
    }

    const [meetings, pinned] = await Promise.all([
      prisma.meeting.findMany({
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        include: { participants: { select: { status: true } } },
      }),
      prisma.notice.findFirst({
        where: { isPinned: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    meetingsForClient = meetings.map((meeting) => ({
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      description: meeting.description,
      isOpen: meeting.isOpen,
      meetingType: meeting.meetingType,
      createdByKakaoId: meeting.createdByKakaoId,
      approvedCount: meeting.participants.filter((participant) => participant.status === "APPROVED").length,
    }));

    pinnedNotice = pinned
      ? { title: pinned.title, body: pinned.body, updatedAt: pinned.updatedAt.toISOString() }
      : null;
  } catch (error) {
    dbUnavailable = true;
    console.error("Failed to load home schedule data", error);
  }

  return (
    <SurfClubLandingPage
      dbUnavailable={dbUnavailable}
      isAdmin={isAdmin}
      initialSelectedDate={initialSelectedDate}
      meetings={meetingsForClient}
      pinnedNotice={pinnedNotice}
      user={userForClient}
    />
  );
}
