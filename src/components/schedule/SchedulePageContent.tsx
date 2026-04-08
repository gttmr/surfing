import SurfClubLandingPage from "@/components/landing/SurfClubLandingPage";
import { getActiveSession } from "@/lib/active-session";
import { getAdminSettlementStatusData } from "@/lib/admin-page-data";
import { prisma } from "@/lib/db";
import {
  buildDetailedMeeting,
  buildSignupInitialData,
  findInitialView,
} from "@/lib/home-view";
import type {
  AdminSettlementStatusSummary,
  HomeUser,
  NoticeItem,
  SettlementAccount,
  SettlementSummary,
  SignupInitialData,
  DetailedMeeting,
} from "@/lib/landing-types";
import { resolveProfileImage } from "@/lib/profile-image";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
  DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
  DEFAULT_SETTLEMENT_BANK_NAME,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
  SETTLEMENT_ACCOUNT_HOLDER_KEY,
  SETTLEMENT_ACCOUNT_NUMBER_KEY,
  SETTLEMENT_BANK_NAME_KEY,
} from "@/lib/settings";
import { getSettlementGroupsForKakaoId } from "@/lib/settlement";
import type { MeetingWithCounts } from "@/lib/types";
import { getTodayInSeoul } from "@/lib/date";

export default async function SchedulePageContent({
  initialSelectedDate = null,
}: {
  initialSelectedDate?: string | null;
}) {
  const today = getTodayInSeoul();
  const sessionUser = await getActiveSession();

  let isAdmin = false;
  let dbUnavailable = false;
  let userForClient: HomeUser | null = sessionUser
    ? {
        kakaoId: sessionUser.kakaoId,
        nickname: sessionUser.nickname,
        profileImage: sessionUser.profileImage,
      }
    : null;
  let meetingsForClient: MeetingWithCounts[] = [];
  let noticesForClient: NoticeItem[] = [];
  let participantOptionPricingGuide = DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE;
  let initialMeetingDetailsById: Record<number, DetailedMeeting> = {};
  let initialSignupDataByMeetingId: Record<number, SignupInitialData> = {};
  let initialSettlementStatusByMeetingId: Record<number, AdminSettlementStatusSummary> = {};
  let initialPendingSettlements: SettlementSummary[] = [];
  let initialSettlementAccount: SettlementAccount | null = null;

  try {
    const [dbUser, meetings, notices, settings, settlementGroups] = await Promise.all([
      sessionUser
        ? prisma.user.findUnique({
            where: { kakaoId: sessionUser.kakaoId },
            select: {
              role: true,
              memberType: true,
              name: true,
              profileImage: true,
              customProfileImageUrl: true,
            },
          })
        : Promise.resolve(null),
      prisma.meeting.findMany({
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        include: { participants: { select: { status: true } } },
      }),
      prisma.notice.findMany({
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.setting.findMany({
        where: {
          key: {
            in: [
              PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
              SETTLEMENT_BANK_NAME_KEY,
              SETTLEMENT_ACCOUNT_NUMBER_KEY,
              SETTLEMENT_ACCOUNT_HOLDER_KEY,
            ],
          },
        },
      }),
      sessionUser ? getSettlementGroupsForKakaoId(sessionUser.kakaoId) : Promise.resolve([]),
    ]);

    isAdmin = dbUser?.role === "ADMIN";

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
      approvedCount: meeting.participants.filter((p) => p.status === "APPROVED").length,
    }));

    noticesForClient = notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      isPinned: notice.isPinned,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
    }));

    const settingsMap = new Map(settings.map((item) => [item.key, item.value]));
    participantOptionPricingGuide =
      settingsMap.get(PARTICIPANT_OPTION_PRICING_GUIDE_KEY) ?? DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE;
    initialSettlementAccount = {
      bankName: settingsMap.get(SETTLEMENT_BANK_NAME_KEY) ?? DEFAULT_SETTLEMENT_BANK_NAME,
      accountNumber: settingsMap.get(SETTLEMENT_ACCOUNT_NUMBER_KEY) ?? DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
      accountHolder: settingsMap.get(SETTLEMENT_ACCOUNT_HOLDER_KEY) ?? DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
    };
    initialPendingSettlements = settlementGroups;

    const initialView = findInitialView(meetingsForClient, today, initialSelectedDate);
    const selectedMeetingIds = initialView.selectedDate
      ? meetingsForClient
          .filter((meeting) => meeting.date === initialView.selectedDate)
          .map((meeting) => meeting.id)
      : [];

    if (selectedMeetingIds.length > 0) {
      const [detailedMeetings, regularCompanions, linkedCompanion] = await Promise.all([
        prisma.meeting.findMany({
          where: { id: { in: selectedMeetingIds } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          include: {
            participants: {
              orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
              include: {
                user: { select: { profileImage: true, customProfileImageUrl: true } },
              },
            },
          },
        }),
        sessionUser && dbUser?.memberType === "REGULAR"
          ? prisma.companion.findMany({
              where: { ownerKakaoId: sessionUser.kakaoId, archivedAt: null },
              orderBy: { createdAt: "asc" },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        sessionUser && dbUser?.memberType === "COMPANION"
          ? prisma.companion.findFirst({
              where: { linkedKakaoId: sessionUser.kakaoId, archivedAt: null },
              include: { owner: { select: { name: true, kakaoId: true } } },
            })
          : Promise.resolve(null),
      ]);

      for (const meeting of detailedMeetings) {
        const detailedMeeting = buildDetailedMeeting(meeting);
        initialMeetingDetailsById[meeting.id] = detailedMeeting;

        if (!sessionUser || !dbUser) continue;

        initialSignupDataByMeetingId[meeting.id] = buildSignupInitialData(
          detailedMeeting,
          sessionUser.kakaoId,
          dbUser,
          regularCompanions,
          linkedCompanion ?? null,
          participantOptionPricingGuide,
        );
      }

      if (isAdmin) {
        const settlementStatusEntries = await Promise.all(
          selectedMeetingIds.map(async (meetingId) => {
            const data = await getAdminSettlementStatusData(meetingId);
            return data ? ([meetingId, data] as const) : null;
          })
        );
        initialSettlementStatusByMeetingId = Object.fromEntries(
          settlementStatusEntries.filter(
            (entry): entry is readonly [number, AdminSettlementStatusSummary] => entry !== null
          )
        );
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
      initialSettlementStatusByMeetingId={initialSettlementStatusByMeetingId}
      initialPendingSettlements={initialPendingSettlements}
      initialSelectedDate={initialSelectedDate}
      initialSettlementAccount={initialSettlementAccount}
      initialSignupDataByMeetingId={initialSignupDataByMeetingId}
      isAdmin={isAdmin}
      meetings={meetingsForClient}
      participantOptionPricingGuide={participantOptionPricingGuide}
      notices={noticesForClient}
      user={userForClient}
    />
  );
}
