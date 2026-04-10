import SurfClubLandingPage from "@/components/landing/SurfClubLandingPage";
import { isSessionUserActive } from "@/lib/active-session";
import { prisma } from "@/lib/db";
import { findInitialView, normalizeSelectedDate } from "@/lib/home-view";
import type {
  DetailedMeeting,
  HomeUser,
  NoticeItem,
  SignupInitialData,
} from "@/lib/landing-types";
import { resolveProfileImage } from "@/lib/profile-image";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
} from "@/lib/settings";
import { getSession } from "@/lib/session";
import type { MeetingWithCounts } from "@/lib/types";
import { getTodayInSeoul } from "@/lib/date";

function buildDetailedMeeting(meeting: {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  isOpen: boolean;
  meetingType: string;
  createdByKakaoId: string | null;
  participants: Array<{
    id: number;
    name: string;
    note: string | null;
    hasLesson: boolean;
    hasBus: boolean;
    hasRental: boolean;
    status: string;
    kakaoId: string;
    companionId: number | null;
    waitlistPosition: number | null;
    user: {
      profileImage: string | null;
      customProfileImageUrl: string | null;
    } | null;
  }>;
}): DetailedMeeting {
  const participantsList = meeting.participants
    .filter((participant) => participant.status !== "CANCELLED")
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      note: participant.note,
      hasLesson: participant.hasLesson,
      hasBus: participant.hasBus,
      hasRental: participant.hasRental,
      status: participant.status,
      kakaoId: participant.kakaoId,
      companionId: participant.companionId,
      waitlistPosition: participant.waitlistPosition,
      profileImage: resolveProfileImage(participant.user),
    }));

  return {
    id: meeting.id,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    description: meeting.description,
    isOpen: meeting.isOpen,
    meetingType: meeting.meetingType,
    createdByKakaoId: meeting.createdByKakaoId,
    approvedCount: participantsList.filter((participant) => participant.status === "APPROVED").length,
    participantsList,
  };
}

const DETAILED_MEETING_INCLUDE = {
  participants: {
    orderBy: [{ status: "asc" as const }, { submittedAt: "asc" as const }],
    include: {
      user: {
        select: {
          profileImage: true,
          customProfileImageUrl: true,
        },
      },
    },
  },
};

export default async function SchedulePageContent({
  initialSelectedDate = null,
}: {
  initialSelectedDate?: string | null;
}) {
  const today = getTodayInSeoul();
  const session = await getSession();
  const validatedDate = normalizeSelectedDate(initialSelectedDate);

  let isAdmin = false;
  let dbUnavailable = false;
  let userForClient: HomeUser | null = null;
  let meetingsForClient: MeetingWithCounts[] = [];
  let noticesForClient: NoticeItem[] = [];
  let participantOptionPricingGuide = DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE;
  const initialMeetingDetailsById: Record<number, DetailedMeeting> = {};
  const initialSignupDataByMeetingId: Record<number, SignupInitialData> = {};

  try {
    // P0: session validation runs in parallel with all other queries
    // P1: settlement data removed — loaded client-side via /api/settlement/current
    // P2: admin settlement status removed — loaded client-side on tab switch
    // P3: detailed meetings + companions fetched in parallel when date is known
    const [
      isActive,
      dbUser,
      meetings,
      notices,
      settings,
      prefetchedDetailedMeetings,
      regularCompanions,
      linkedCompanion,
    ] = await Promise.all([
      session ? isSessionUserActive(session.kakaoId) : false,
      session
        ? prisma.user.findUnique({
            where: { kakaoId: session.kakaoId },
            select: {
              role: true,
              memberType: true,
              name: true,
              profileImage: true,
              customProfileImageUrl: true,
            },
          })
        : null,
      prisma.meeting.findMany({
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        include: {
          _count: {
            select: { participants: { where: { status: "APPROVED" } } },
          },
        },
      }),
      prisma.notice.findMany({
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.setting.findMany({
        where: { key: PARTICIPANT_OPTION_PRICING_GUIDE_KEY },
      }),
      validatedDate
        ? prisma.meeting.findMany({
            where: { date: validatedDate },
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
            include: DETAILED_MEETING_INCLUDE,
          })
        : Promise.resolve([]),
      session
        ? prisma.companion.findMany({
            where: { ownerKakaoId: session.kakaoId, archivedAt: null },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      session
        ? prisma.companion.findFirst({
            where: { linkedKakaoId: session.kakaoId, archivedAt: null },
            include: { owner: { select: { name: true, kakaoId: true } } },
          })
        : Promise.resolve(null),
    ]);

    const sessionUser = session && isActive ? session : null;

    isAdmin = !!(sessionUser && dbUser?.role === "ADMIN");

    if (sessionUser && dbUser) {
      userForClient = {
        kakaoId: sessionUser.kakaoId,
        nickname: dbUser.name || sessionUser.nickname,
        profileImage: resolveProfileImage(dbUser) ?? sessionUser.profileImage,
      };
    }

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
      approvedCount: meeting._count.participants,
    }));

    noticesForClient = notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      isPinned: notice.isPinned,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
    }));

    participantOptionPricingGuide =
      settings[0]?.value ?? DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE;

    const initialView = findInitialView(meetingsForClient, today, initialSelectedDate);
    const selectedMeetingIds = initialView.selectedDate
      ? meetingsForClient.filter((meeting) => meeting.date === initialView.selectedDate).map((meeting) => meeting.id)
      : [];

    if (selectedMeetingIds.length > 0) {
      // Use prefetched data if date matched, otherwise fetch for auto-selected date
      const detailedMeetings =
        validatedDate && prefetchedDetailedMeetings.length > 0
          ? prefetchedDetailedMeetings
          : await prisma.meeting.findMany({
              where: { id: { in: selectedMeetingIds } },
              orderBy: [{ date: "asc" }, { startTime: "asc" }],
              include: DETAILED_MEETING_INCLUDE,
            });

      for (const meeting of detailedMeetings) {
        const detailedMeeting = buildDetailedMeeting(meeting);
        initialMeetingDetailsById[meeting.id] = detailedMeeting;

        if (!sessionUser) continue;

        const myParticipant = detailedMeeting.participantsList.find(
          (participant) =>
            participant.kakaoId === sessionUser.kakaoId &&
            participant.companionId === null &&
            participant.status !== "CANCELLED"
        );

        const signedUpCompanionData = detailedMeeting.participantsList.reduce<Record<number, SignupInitialData["signedUpCompanionData"][number]>>(
          (acc, participant) => {
            if (
              participant.kakaoId === sessionUser.kakaoId &&
              participant.companionId !== null &&
              participant.status !== "CANCELLED"
            ) {
              acc[participant.companionId] = {
                participantId: participant.id,
                hasLesson: participant.hasLesson,
                hasBus: participant.hasBus,
                hasRental: participant.hasRental,
              };
            }
            return acc;
          },
          {}
        );

        const linkedStatus = dbUser?.memberType === "COMPANION"
          ? linkedCompanion
            ? {
                linked: true,
                ownerApplied: detailedMeeting.participantsList.some(
                  (participant) =>
                    participant.kakaoId === linkedCompanion.ownerKakaoId &&
                    participant.companionId === null &&
                    participant.status !== "CANCELLED"
                ),
                companion: {
                  id: linkedCompanion.id,
                  name: linkedCompanion.name,
                  owner: linkedCompanion.owner,
                },
                participant: (() => {
                  const participant = detailedMeeting.participantsList.find(
                    (item) => item.companionId === linkedCompanion.id && item.status !== "CANCELLED"
                  );
                  return participant
                    ? {
                        id: participant.id,
                        status: participant.status,
                        hasLesson: participant.hasLesson,
                        hasBus: participant.hasBus,
                        hasRental: participant.hasRental,
                      }
                    : null;
                })(),
              }
            : { linked: false, ownerApplied: false }
          : null;

        initialSignupDataByMeetingId[meeting.id] = {
          userProfile: dbUser
            ? {
                memberType: dbUser.memberType,
                name: dbUser.name,
              }
            : null,
          participantOptionPricingGuide,
          companions: regularCompanions,
          myParticipant: myParticipant
            ? {
                id: myParticipant.id,
                status: myParticipant.status,
                waitlistPosition: myParticipant.waitlistPosition ?? null,
                note: myParticipant.note ?? "",
                hasLesson: !!myParticipant.hasLesson,
                hasBus: !!myParticipant.hasBus,
                hasRental: !!myParticipant.hasRental,
              }
            : null,
          signedUpCompanionData,
          linkedStatus,
        };
      }
    }
  } catch (error) {
    dbUnavailable = true;
    console.error("Failed to load home schedule data", error);
  }

  return (
    <SurfClubLandingPage
      dbUnavailable={dbUnavailable}
      initialMeetingDetailsById={initialMeetingDetailsById}
      initialSettlementStatusByMeetingId={{}}
      initialPendingSettlements={[]}
      initialSelectedDate={initialSelectedDate}
      initialSettlementAccount={null}
      initialSignupDataByMeetingId={initialSignupDataByMeetingId}
      isAdmin={isAdmin}
      meetings={meetingsForClient}
      participantOptionPricingGuide={participantOptionPricingGuide}
      notices={noticesForClient}
      user={userForClient}
    />
  );
}
