import SurfClubLandingPage from "@/components/landing/SurfClubLandingPage";
import { isSessionUserActive } from "@/lib/active-session";
import { prisma } from "@/lib/db";
import { findInitialView, normalizeSelectedDate } from "@/lib/home-view";
import type {
  DetailedMeeting,
  HomeUser,
  MyMeetingParticipation,
  NoticeItem,
  SignupInitialData,
  UserNotificationItem,
} from "@/lib/landing-types";
import { resolveProfileImage } from "@/lib/profile-image";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
} from "@/lib/settings";
import { getSession } from "@/lib/session";
import type { MeetingWithCounts } from "@/lib/types";
import { getTodayInSeoul } from "@/lib/date";
import {
  buildSignupPricingPreview,
  DEFAULT_SIGNUP_PRICING_PREVIEW,
} from "@/lib/signup-pricing";
import { lastMeetingDate } from "@/lib/meeting-days";
import { getSurfUsageItems } from "@/lib/surf-usage-data";

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
  endDate: string | null;
  regularFee: number;
  companionFee: number;
  lodgingFee: number;
  participants: Array<{
    id: number;
    name: string;
    note: string | null;
    hasLesson: boolean;
    hasBus: boolean;
    hasRental: boolean;
    hasDay2Rental: boolean;
    usesClubLodging: boolean;
    status: string;
    absentAt: Date | null;
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
      hasDay2Rental: participant.hasDay2Rental,
      usesClubLodging: participant.usesClubLodging,
      status: participant.status,
      absent: participant.absentAt !== null,
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
    endDate: meeting.endDate,
    regularFee: meeting.regularFee,
    companionFee: meeting.companionFee,
    lodgingFee: meeting.lodgingFee,
    participantsList,
  };
}

function sanitizeDetailedMeetingForViewer(
  meeting: DetailedMeeting,
  isAdmin: boolean,
  viewerKakaoId: string | null
): DetailedMeeting {
  if (isAdmin) return meeting;
  const publicGroupIds = new Map<string, string>();
  let nextGroup = 1;
  return {
    ...meeting,
    participantsList: meeting.participantsList.map((participant) => {
      if (participant.kakaoId === viewerKakaoId) return participant;
      let publicGroupId = publicGroupIds.get(participant.kakaoId);
      if (!publicGroupId) {
        publicGroupId = `meeting-${meeting.id}-group-${nextGroup}`;
        publicGroupIds.set(participant.kakaoId, publicGroupId);
        nextGroup += 1;
      }
      return {
        ...participant,
        kakaoId: publicGroupId,
        note: null,
        hasLesson: false,
        hasBus: false,
        hasRental: false,
        hasDay2Rental: false,
        usesClubLodging: false,
      };
    }),
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
  let userNotificationsForClient: UserNotificationItem[] = [];
  let participantOptionPricingGuide = DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE;
  let signupPricingPreview = DEFAULT_SIGNUP_PRICING_PREVIEW;
  const initialMeetingDetailsById: Record<number, DetailedMeeting> = {};
  const initialSignupDataByMeetingId: Record<number, SignupInitialData> = {};
  const myParticipationByMeetingId: Record<number, MyMeetingParticipation> = {};

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
      usageItems,
      prefetchedDetailedMeetings,
      regularCompanions,
      linkedCompanion,
      userNotifications,
      myUpcomingParticipations,
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
        where: { key: { in: [PARTICIPANT_OPTION_PRICING_GUIDE_KEY] } },
      }),
      getSurfUsageItems(),
      validatedDate
        ? prisma.meeting.findMany({
            where: { date: { lte: validatedDate }, OR: [{ date: validatedDate }, { endDate: { gte: validatedDate } }] },
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
      session
        ? prisma.userNotification.findMany({
            where: { recipientKakaoId: session.kakaoId },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
      session
        ? prisma.participant.findMany({
            where: {
              kakaoId: session.kakaoId,
              companionId: null,
              meeting: { OR: [{ date: { gte: getTodayInSeoul() } }, { endDate: { gte: getTodayInSeoul() } }] },
            },
            select: { meetingId: true, status: true, waitlistPosition: true },
          })
        : Promise.resolve([]),
    ]);

    const sessionUser = session && isActive ? session : null;

    isAdmin = !!(sessionUser && dbUser?.role === "ADMIN");

    if (sessionUser) {
      for (const participation of myUpcomingParticipations) {
        myParticipationByMeetingId[participation.meetingId] = {
          status: participation.status,
          waitlistPosition: participation.waitlistPosition,
        };
      }
    }

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
      endDate: meeting.endDate,
      regularFee: meeting.regularFee,
      companionFee: meeting.companionFee,
      lodgingFee: meeting.lodgingFee,
    }));

    noticesForClient = notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      isPinned: notice.isPinned,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
    }));

    userNotificationsForClient = sessionUser
      ? userNotifications.map((notification) => ({
          id: notification.id,
          type: notification.type as UserNotificationItem["type"],
          title: notification.title,
          body: notification.body,
          meetingId: notification.meetingId,
          participantId: notification.participantId,
          foodOrderItemId: notification.foodOrderItemId,
          readAt: notification.readAt?.toISOString() ?? null,
          createdAt: notification.createdAt.toISOString(),
        }))
      : [];

    const settingsMap = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
    participantOptionPricingGuide =
      settingsMap[PARTICIPANT_OPTION_PRICING_GUIDE_KEY] ?? DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE;
    signupPricingPreview = buildSignupPricingPreview({ regular: 0, companion: 0 }, usageItems);

    const initialView = findInitialView(meetingsForClient, today, initialSelectedDate);
    // 1박은 일정 중 어느 날을 골라도 같은 모임이다.
    const selectedMeetingIds = initialView.selectedDate
      ? meetingsForClient
          .filter((meeting) => meeting.date <= initialView.selectedDate! && initialView.selectedDate! <= lastMeetingDate(meeting))
          .map((meeting) => meeting.id)
      : [];
    const detailedMeetingIds = selectedMeetingIds;

    if (selectedMeetingIds.length > 0) {
      // Use prefetched data if date matched, otherwise fetch for auto-selected date
      const prefetchedIds = new Set(prefetchedDetailedMeetings.map((meeting) => meeting.id));
      const detailedMeetings =
        validatedDate && detailedMeetingIds.every((meetingId) => prefetchedIds.has(meetingId))
          ? prefetchedDetailedMeetings
          : await prisma.meeting.findMany({
              where: { id: { in: detailedMeetingIds } },
              orderBy: [{ date: "asc" }, { startTime: "asc" }],
              include: DETAILED_MEETING_INCLUDE,
            });

      const detailedMeetingsById = new Map(
        detailedMeetings.map((meeting) => [meeting.id, buildDetailedMeeting(meeting)])
      );

      for (const detailedMeeting of detailedMeetingsById.values()) {
        const meeting = detailedMeeting;
        initialMeetingDetailsById[meeting.id] = sanitizeDetailedMeetingForViewer(
          detailedMeeting,
          isAdmin,
          sessionUser?.kakaoId ?? null
        );

      }

      for (const meetingId of selectedMeetingIds) {
        const detailedMeeting = detailedMeetingsById.get(meetingId);
        if (!detailedMeeting || !sessionUser) continue;
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
                day2HasRental: participant.hasDay2Rental,
                usesClubLodging: participant.usesClubLodging,
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
                        day2HasRental: participant.hasDay2Rental,
                        usesClubLodging: participant.usesClubLodging,
                      }
                    : null;
                })(),
              }
            : { linked: false, ownerApplied: false }
          : null;

        initialSignupDataByMeetingId[detailedMeeting.id] = {
          userProfile: dbUser
            ? {
                memberType: dbUser.memberType,
                name: dbUser.name,
              }
            : null,
          participantOptionPricingGuide,
          pricingPreview: signupPricingPreview,
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
                day2HasRental: !!myParticipant.hasDay2Rental,
                usesClubLodging: !!myParticipant.usesClubLodging,
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
      initialPendingSettlements={[]}
      initialSelectedDate={initialSelectedDate}
      initialSettlementAccount={null}
      initialSignupDataByMeetingId={initialSignupDataByMeetingId}
      myParticipationByMeetingId={myParticipationByMeetingId}
      initialUserNotifications={userNotificationsForClient}
      isAdmin={isAdmin}
      meetings={meetingsForClient}
      participantOptionPricingGuide={participantOptionPricingGuide}
      notices={noticesForClient}
      user={userForClient}
    />
  );
}
