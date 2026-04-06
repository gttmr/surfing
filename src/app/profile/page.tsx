"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BasicProfileSection,
  CompanionManagementSection,
  MobileProfileSaveDock,
  ProfileHeaderSection,
  ProfileSetupModal,
  ProfileTabs,
} from "@/components/profile/profile-page-sections";
import { useProfilePageState } from "@/components/profile/useProfilePageState";

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.477 2 10.857c0 2.713 1.584 5.1 3.988 6.577L5 21l4.29-2.287C10.145 18.9 11.058 19 12 19c5.523 0 10-3.477 10-7.143C22 6.477 17.523 3 12 3z" />
    </svg>
  );
}

const MEMBER_TYPE_LABELS: Record<string, string> = {
  REGULAR: "정회원",
  COMPANION: "동반인",
};
const MEMBER_TYPE_COLORS: Record<string, string> = {
  REGULAR: "brand-chip-soft",
  COMPANION: "brand-chip-companion",
};

export default function ProfilePageWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[var(--brand-page)]"><p className="brand-text-subtle text-sm">불러오는 중...</p></div>}>
      <ProfilePage />
    </Suspense>
  );
}

function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get("setup") === "true";
  const {
    state: {
      user,
      loading,
      saving,
      saved,
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
      selectedSetupCompanion,
      selectedProfileCompanion,
    },
    actions: {
      setUser,
      setShowSetup,
      setActiveTab,
      setName,
      setSetupName,
      setPhoneNumber,
      setSetupMemberType,
      setSelectedOwnerKakaoId,
      setSelectedCompanionId,
      setAddCompanionName,
      handleSetupSave,
      handleSave,
      handleAddCompanion,
      handleRemoveCompanion,
      handleLogout,
    },
  } = useProfilePageState({ isSetup, router });

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-page)]">
      <p className="brand-text-subtle text-sm">불러오는 중...</p>
    </div>
  );

  if (notLoggedIn) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--brand-page)] px-6">
      <div className="brand-card-soft w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">🏄</div>
        <h1 className="mb-2 text-xl font-extrabold text-[var(--brand-text)]">로그인이 필요합니다</h1>
        <p className="brand-text-muted mb-6 text-sm">카카오 로그인 후 나의 프로필을 관리할 수 있습니다.</p>
        <button
          onClick={() => window.location.href = `/api/auth/kakao?returnTo=/profile`}
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

  const isRegular = (user?.memberType ?? "REGULAR") === "REGULAR";
  const isAdmin = user?.role === "ADMIN";
  const isCompanionWithoutOwner = !isRegular && !linkedCompanionInfo?.linked;
  const profileDisplayName = user?.name || "이름 없음";
  const profileFallbackSeed = user?.kakaoId ?? profileDisplayName;
  const profileSaveValid = isRegular ? !!name.trim() : !!selectedCompanionId;

  // 동반인 설정 유효성: 동반인 선택 시 정회원과 등록된 본인 엔트리가 모두 필요
  const companionSetupValid = setupMemberType === "REGULAR" ||
    (!!selectedOwnerKakaoId && !!selectedCompanionId);

  return (
    <div className="min-h-screen bg-[var(--brand-page)] pb-12 text-[var(--brand-text)]">
      <ProfileSetupModal
        show={showSetup}
        saving={saving}
        linking={linking}
        setupName={setupName}
        name={name}
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

      <main className="mx-auto flex w-full max-w-[390px] flex-col gap-4 px-4 pb-28 pt-20 sm:gap-6 sm:pb-12 sm:pt-24">
        <ProfileHeaderSection
          user={user}
          isAdmin={isAdmin}
          profileDisplayName={profileDisplayName}
          profileFallbackSeed={profileFallbackSeed}
          companionsCount={companions.length}
          memberTypeLabels={MEMBER_TYPE_LABELS}
          memberTypeColors={MEMBER_TYPE_COLORS}
          onUserUpdated={setUser}
          onLogout={handleLogout}
        />

        {isRegular ? (
          <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
        ) : null}

        <div className={isRegular ? "min-h-[23rem] sm:min-h-[27rem]" : ""}>
          {(!isRegular || activeTab === "profile") ? (
            <BasicProfileSection
              isRegular={isRegular}
              isCompanionWithoutOwner={isCompanionWithoutOwner}
              saving={saving}
              saved={saved}
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
            />
          ) : null}

          {isRegular && activeTab === "companions" ? (
            <CompanionManagementSection
              companions={companions}
              addCompanionName={addCompanionName}
              addingCompanion={addingCompanion}
              onNameChange={setAddCompanionName}
              onAddCompanion={handleAddCompanion}
              onRemoveCompanion={handleRemoveCompanion}
            />
          ) : null}
        </div>

      </main>
      <MobileProfileSaveDock
        visible={!isRegular || activeTab === "profile"}
        saving={saving}
        saved={saved}
        profileSaveValid={profileSaveValid}
        isCompanionWithoutOwner={isCompanionWithoutOwner}
      />
    </div>
  );
}
