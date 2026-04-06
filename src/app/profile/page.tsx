import { prisma } from "@/lib/db";
import { withResolvedProfileImage } from "@/lib/profile-image";
import { getSession } from "@/lib/session";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";
import type {
  LinkedCompanionInfo,
  OwnerCompanion,
  ProfileInitialData,
  RegularMember,
} from "@/components/profile/useProfilePageState";

export const dynamic = "force-dynamic";

async function getProfileInitialData(isSetup: boolean): Promise<ProfileInitialData> {
  const session = await getSession();
  if (!session) {
    return { notLoggedIn: true };
  }

  const user = await prisma.user.upsert({
    where: { kakaoId: session.kakaoId },
    update: {
      profileImage: session.profileImage || null,
    },
    create: {
      kakaoId: session.kakaoId,
      name: session.nickname || null,
      profileImage: session.profileImage || null,
      role: "MEMBER",
    },
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  const isCompanion = user.memberType === "COMPANION";
  const needsMemberLookup = isCompanion || isSetup;

  const [companions, regularMembers, linkedCompanion] = await Promise.all([
    prisma.companion.findMany({
      where: { ownerKakaoId: session.kakaoId, archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    needsMemberLookup
      ? prisma.user.findMany({
          where: {
            memberType: "REGULAR",
            kakaoId: { not: session.kakaoId },
            companions: {
              some: { archivedAt: null },
            },
          },
          select: {
            kakaoId: true,
            name: true,
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as RegularMember[]),
    isCompanion
      ? prisma.companion.findFirst({
          where: { linkedKakaoId: session.kakaoId, archivedAt: null },
          include: {
            owner: { select: { kakaoId: true, name: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  let linkedCompanionInfo: LinkedCompanionInfo | null = null;
  let selectedOwnerKakaoId: string | null = null;
  let selectedCompanionId: number | null = null;
  let ownerCompanions: OwnerCompanion[] = [];

  if (isCompanion) {
    if (linkedCompanion) {
      selectedOwnerKakaoId = linkedCompanion.owner.kakaoId;
      selectedCompanionId = linkedCompanion.id;
      linkedCompanionInfo = {
        linked: true,
        companion: {
          id: linkedCompanion.id,
          name: linkedCompanion.name,
          owner: linkedCompanion.owner,
        },
      };
      ownerCompanions = await prisma.companion.findMany({
        where: {
          ownerKakaoId: linkedCompanion.owner.kakaoId,
          archivedAt: null,
        },
        select: {
          id: true,
          name: true,
          linkedKakaoId: true,
        },
        orderBy: { createdAt: "asc" },
      });
    } else {
      linkedCompanionInfo = { linked: false };
    }
  }

  return {
    notLoggedIn: false,
    user: {
      ...withResolvedProfileImage(user),
      createdAt: user.createdAt.toISOString(),
    },
    companions: companions.map((companion) => ({
      ...companion,
      createdAt: companion.createdAt.toISOString(),
    })),
    regularMembers,
    linkedCompanionInfo,
    ownerCompanions,
    selectedOwnerKakaoId,
    selectedCompanionId,
  };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const { setup } = await searchParams;
  const isSetup = setup === "true";
  const initialData = await getProfileInitialData(isSetup);

  return <ProfilePageClient initialData={initialData} isSetup={isSetup} />;
}
