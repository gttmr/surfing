"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BasicProfileSection,
  CompanionManagementSection,
  MobileProfileSaveDock,
  PersonalJourneyLinks,
  ProfileHeaderSection,
  ProfileSetupModal,
  ProfileTabs,
} from "@/components/profile/profile-page-sections";
import {
  type ProfileInitialData,
  useProfilePageState,
} from "@/components/profile/useProfilePageState";
import { KakaoIcon } from "@/components/meeting/signup-form-controls";
import { ProfileLeaveDialog } from "@/components/profile/ProfileLeaveDialog";
import { useProfileLeaveGuard } from "@/components/profile/useProfileLeaveGuard";

const MEMBER_TYPE_LABELS: Record<string, string> = {
  REGULAR: "정회원",
  COMPANION: "동반인",
};
const MEMBER_TYPE_COLORS: Record<string, string> = {
  REGULAR: "brand-chip-soft",
  COMPANION: "brand-chip-companion",
};

export function ProfilePageClient({
  isSetup,
  initialData,
}: {
  isSetup: boolean;
  initialData: ProfileInitialData;
}) {
  const router = useRouter();
  const {
    state: {
      user,
      saving,
      saved,
      isEditing,
      isDirty,
      saveError,
      companionError,
      notLoggedIn,
      showSetup,
      activeTab,
      name,
      setupName,
      phoneNumber,
      setupMemberType,
      regularMembers,
      selectedOwnerKakaoId,
      ownerCompanions,
      loadingOwnerCompanions,
      selectedCompanionId,
      linking,
      linkedCompanionInfo,
      companions,
      addCompanionName,
      addingCompanion,
      avatarDraft,
      selectedSetupCompanion,
      selectedProfileCompanion,
    },
    actions: {
      setActiveTab,
      setName,
      setSetupName,
      setPhoneNumber,
      setSetupMemberType,
      setSelectedOwnerKakaoId,
      setSelectedCompanionId,
      setAddCompanionName,
      setAvatarDraft,
      handleSetupSave,
      handleSave,
      handleAddCompanion,
      handleRemoveCompanion,
      handleLogout,
      beginEditing,
      discardDraft,
    },
  } = useProfilePageState({ isSetup, router, initialData });

  const leaveGuard = useProfileLeaveGuard({
    activeTab,
    discardDraft,
    isDirty,
    logout: handleLogout,
    push: router.push,
    setActiveTab,
  });

  if (notLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-page px-6">
        <div className="brand-card-soft w-full max-w-sm rounded-2xl p-8 text-center">
          <div className="mb-4 text-5xl">🏄</div>
          <h1 className="mb-2 text-xl font-extrabold text-brand-text">로그인이 필요합니다</h1>
          <p className="brand-text-muted mb-6 text-sm">카카오 로그인 후 나의 프로필을 관리할 수 있습니다.</p>
          <button
            type="button"
            onClick={() => { window.location.href = "/api/auth/kakao?returnTo=/profile"; }}
            className="brand-button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors"
          >
            <KakaoIcon />
            카카오로 로그인
          </button>
          <Link href="/" className="brand-text-subtle brand-link mt-4 block text-sm transition-colors">
            &larr; 홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const isRegular = (user?.memberType ?? "REGULAR") === "REGULAR";
  const canAccessAdminPortal = user?.role === "ADMIN";
  const canAccessShopPortal = user?.role === "ADMIN" || user?.role === "SHOP_OWNER";
  const isCompanionWithoutOwner = !isRegular && !linkedCompanionInfo?.linked;
  const profileDisplayName = user?.name || "이름 없음";
  const profileFallbackSeed = user?.kakaoId ?? profileDisplayName;
  const profileSaveValid = isRegular ? !!name.trim() : !!selectedCompanionId;
  const companionSetupValid = setupMemberType === "REGULAR" || (!!selectedOwnerKakaoId && !!selectedCompanionId);

  return (
    <div className="min-h-screen bg-brand-page pb-12 text-brand-text">
      <ProfileLeaveDialog
        onDiscard={leaveGuard.discardAndContinue}
        onStay={leaveGuard.stay}
        open={leaveGuard.dialogOpen}
      />
      <ProfileSetupModal
        show={showSetup}
        saving={saving}
        linking={linking}
        setupName={setupName}
        setupMemberType={setupMemberType}
        selectedOwnerKakaoId={selectedOwnerKakaoId}
        selectedCompanionId={selectedCompanionId}
        regularMembers={regularMembers}
        ownerCompanions={ownerCompanions}
        loadingOwnerCompanions={loadingOwnerCompanions}
        selectedSetupCompanion={selectedSetupCompanion}
        companionSetupValid={companionSetupValid}
        onSetupNameChange={setSetupName}
        onMemberTypeChange={(nextType) => {
          setSetupMemberType(nextType);
          setSelectedOwnerKakaoId(null);
          setSelectedCompanionId(null);
          if (nextType === "REGULAR") {
            setSetupName(name.trim() || setupName);
          }
        }}
        onSelectOwner={setSelectedOwnerKakaoId}
        onSelectCompanion={setSelectedCompanionId}
        onSave={handleSetupSave}
      />

      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 pb-28 pt-20 sm:gap-6 sm:pb-12 sm:pt-24">
        <ProfileHeaderSection
          user={user}
          profileDisplayName={profileDisplayName}
          profileFallbackSeed={profileFallbackSeed}
          companionsCount={companions.length}
          editable={isEditing}
          avatarDraft={avatarDraft}
          memberTypeLabels={MEMBER_TYPE_LABELS}
          memberTypeColors={MEMBER_TYPE_COLORS}
          onAvatarDraftChange={setAvatarDraft}
          onLogout={leaveGuard.requestLogout}
          onNavigate={leaveGuard.onNavigate}
        />

        <PersonalJourneyLinks
          canAccessAdminPortal={canAccessAdminPortal}
          canAccessShopPortal={canAccessShopPortal}
          onNavigate={leaveGuard.onNavigate}
        />

        {isRegular ? (
          <ProfileTabs activeTab={activeTab} onChange={leaveGuard.requestTab}>
          {(!isRegular || activeTab === "profile") ? (
            <BasicProfileSection
              isRegular={isRegular}
              isCompanionWithoutOwner={isCompanionWithoutOwner}
              isEditing={isEditing}
              isDirty={isDirty}
              saving={saving}
              saved={saved}
              saveError={saveError}
              profileSaveValid={profileSaveValid}
              name={name}
              phoneNumber={phoneNumber}
              userMemberType={user?.memberType ?? "REGULAR"}
              regularMembers={regularMembers}
              selectedOwnerKakaoId={selectedOwnerKakaoId}
              ownerCompanions={ownerCompanions}
              loadingOwnerCompanions={loadingOwnerCompanions}
              selectedCompanionId={selectedCompanionId}
              linkedCompanionInfo={linkedCompanionInfo}
              selectedProfileCompanion={selectedProfileCompanion}
              memberTypeLabels={MEMBER_TYPE_LABELS}
              onSubmit={handleSave}
              onNameChange={setName}
              onPhoneNumberChange={setPhoneNumber}
              onSelectOwner={setSelectedOwnerKakaoId}
              onSelectCompanion={setSelectedCompanionId}
              onBeginEditing={beginEditing}
              onDiscardDraft={discardDraft}
            />
          ) : null}

          {isRegular && activeTab === "companions" ? (
            <CompanionManagementSection
              companions={companions}
              addCompanionName={addCompanionName}
              addingCompanion={addingCompanion}
              error={companionError}
              onNameChange={setAddCompanionName}
              onAddCompanion={handleAddCompanion}
              onRemoveCompanion={handleRemoveCompanion}
            />
          ) : null}
          </ProfileTabs>
        ) : (
          <BasicProfileSection
            isRegular={isRegular}
            isCompanionWithoutOwner={isCompanionWithoutOwner}
            isEditing={isEditing}
            isDirty={isDirty}
            saving={saving}
            saved={saved}
            saveError={saveError}
            profileSaveValid={profileSaveValid}
            name={name}
            phoneNumber={phoneNumber}
            userMemberType={user?.memberType ?? "REGULAR"}
            regularMembers={regularMembers}
            selectedOwnerKakaoId={selectedOwnerKakaoId}
            ownerCompanions={ownerCompanions}
            loadingOwnerCompanions={loadingOwnerCompanions}
            selectedCompanionId={selectedCompanionId}
            linkedCompanionInfo={linkedCompanionInfo}
            selectedProfileCompanion={selectedProfileCompanion}
            memberTypeLabels={MEMBER_TYPE_LABELS}
            onSubmit={handleSave}
            onNameChange={setName}
            onPhoneNumberChange={setPhoneNumber}
            onSelectOwner={setSelectedOwnerKakaoId}
            onSelectCompanion={setSelectedCompanionId}
            onBeginEditing={beginEditing}
            onDiscardDraft={discardDraft}
          />
        )}
      </main>

      <MobileProfileSaveDock
        visible={isEditing && (!isRegular || activeTab === "profile")}
        saving={saving}
        saved={saved}
        profileSaveValid={profileSaveValid}
        isCompanionWithoutOwner={isCompanionWithoutOwner}
        isDirty={isDirty}
      />
    </div>
  );
}
