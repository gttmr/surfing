"use client";

import Image from "next/image";
import Link from "next/link";
import { ProfileImageUploader } from "@/components/profile/ProfileImageUploader";
import type {
  CompanionItem,
  LinkedCompanionInfo,
  OwnerCompanion,
  RegularMember,
  UserProfile,
} from "@/components/profile/useProfilePageState";

type MemberTypeLabels = Record<string, string>;
type MemberTypeColors = Record<string, string>;

type SetupModalProps = {
  show: boolean;
  saving: boolean;
  linking: boolean;
  setupName: string;
  setupMemberType: "REGULAR" | "COMPANION";
  selectedOwnerKakaoId: string | null;
  selectedCompanionId: number | null;
  regularMembers: RegularMember[];
  ownerCompanions: OwnerCompanion[];
  loadingOwnerCompanions: boolean;
  selectedSetupCompanion: OwnerCompanion | null;
  companionSetupValid: boolean;
  onSetupNameChange: (value: string) => void;
  onMemberTypeChange: (value: "REGULAR" | "COMPANION") => void;
  onSelectOwner: (value: string | null) => void;
  onSelectCompanion: (value: number | null) => void;
  onSave: () => void;
};

export function ProfileSetupModal({
  show,
  saving,
  linking,
  setupName,
  setupMemberType,
  selectedOwnerKakaoId,
  selectedCompanionId,
  regularMembers,
  ownerCompanions,
  loadingOwnerCompanions,
  selectedSetupCompanion,
  companionSetupValid,
  onSetupNameChange,
  onMemberTypeChange,
  onSelectOwner,
  onSelectCompanion,
  onSave,
}: SetupModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="brand-card-soft max-w-sm w-full rounded-2xl p-6">
        <div className="mb-5 text-center">
          <div className="mb-2 text-4xl">🏄‍♂️</div>
          <h2 className="text-xl font-extrabold text-[var(--brand-text)]">환영합니다!</h2>
          <p className="brand-text-muted mt-1 text-sm">아래 정보를 입력해주세요</p>
        </div>

        <div className="flex min-h-[24rem] flex-col">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--brand-text)]">
              회원 유형 <span className="text-[var(--brand-error)]">*</span>
              <span className="brand-text-subtle ml-1 text-xs font-normal">(가입 후 변경 불가)</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onMemberTypeChange("REGULAR")}
                className={`brand-select-card flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
                  setupMemberType === "REGULAR"
                    ? "brand-toggle-active border-[var(--brand-primary-border-strong)]"
                    : "text-[var(--brand-primary-text)]"
                }`}
              >
                정회원
              </button>
              <button
                type="button"
                onClick={() => onMemberTypeChange("COMPANION")}
                className={`brand-select-card flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
                  setupMemberType === "COMPANION"
                    ? "brand-toggle-active border-[var(--brand-primary-border-strong)]"
                    : "text-[var(--brand-primary-text)]"
                }`}
              >
                동반인
              </button>
            </div>
            <p className="brand-text-subtle mt-2 text-xs">
              {setupMemberType === "REGULAR"
                ? "직접 모임에 신청하고 동반인을 등록할 수 있습니다."
                : "정회원에 의해 동반인으로 등록된 경우 선택하세요."}
            </p>
          </div>

          <div className="mt-3 flex-1">
            {setupMemberType === "REGULAR" ? (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                  이름 <span className="text-[var(--brand-error)]">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={setupName}
                  onChange={(e) => onSetupNameChange(e.target.value)}
                  placeholder="동호회에서 사용할 이름"
                  className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[var(--brand-text)]">
                    소속 정회원 선택 <span className="text-[var(--brand-error)]">*</span>
                  </label>
                  {regularMembers.length === 0 ? (
                    <p className="brand-text-subtle py-3 text-center text-xs">동반인을 등록한 정회원이 없습니다</p>
                  ) : (
                    <div className="brand-list-scroll max-h-36 space-y-1.5 overflow-y-auto rounded-xl p-2">
                      {regularMembers.map((member) => (
                        <button
                          key={member.kakaoId}
                          type="button"
                          onClick={() => onSelectOwner(member.kakaoId)}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            selectedOwnerKakaoId === member.kakaoId
                              ? "bg-[var(--brand-primary-soft)] font-semibold text-[var(--brand-primary-text)]"
                              : "text-[var(--brand-text)] hover:bg-[var(--brand-surface)]"
                          }`}
                        >
                          {member.name || "이름 없음"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedOwnerKakaoId ? (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[var(--brand-text)]">
                      내 이름 선택 <span className="text-[var(--brand-error)]">*</span>
                    </label>
                    {loadingOwnerCompanions ? (
                      <p className="brand-text-subtle py-2 text-center text-xs">불러오는 중...</p>
                    ) : (
                      <div className="space-y-1.5">
                        {ownerCompanions.filter((companion) => !companion.linkedKakaoId).map((companion) => (
                          <button
                            key={companion.id}
                            type="button"
                            onClick={() => onSelectCompanion(selectedCompanionId === companion.id ? null : companion.id)}
                            className={`brand-select-card w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                              selectedCompanionId === companion.id
                                ? "brand-toggle-active border-[var(--brand-primary-border-strong)] font-semibold"
                                : "text-[var(--brand-text)]"
                            }`}
                          >
                            {companion.name}
                          </button>
                        ))}
                        {!ownerCompanions.filter((companion) => !companion.linkedKakaoId).length ? (
                          <p className="brand-text-subtle py-2 text-center text-xs">선택 가능한 동반인 이름이 없습니다</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="brand-panel-white rounded-xl px-4 py-4">
                    <p className="brand-text-subtle text-xs">
                      먼저 소속 정회원을 선택하면 등록된 동반인 이름 목록이 표시됩니다.
                    </p>
                  </div>
                )}

                {selectedSetupCompanion ? (
                  <div className="brand-panel-white rounded-xl px-4 py-3">
                    <p className="brand-text-subtle text-xs">선택된 이름</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--brand-text)]">{selectedSetupCompanion.name}</p>
                    <p className="brand-text-subtle mt-2 text-xs">
                      동반인은 정회원이 등록한 실명 엔트리를 그대로 사용합니다.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={saving || linking || !companionSetupValid}
          className={`mt-0 w-full rounded-xl py-3 text-sm font-bold transition-all ${
            saving || linking || !companionSetupValid
              ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]"
              : "brand-button-primary active:scale-[0.99]"
          }`}
        >
          {saving || linking ? "저장 중..." : "시작하기"}
        </button>
      </div>
    </div>
  );
}

type HeaderProps = {
  user: UserProfile | null;
  isAdmin: boolean;
  profileDisplayName: string;
  profileFallbackSeed: string;
  companionsCount: number;
  memberTypeLabels: MemberTypeLabels;
  memberTypeColors: MemberTypeColors;
  onUserUpdated: (updater: (prev: UserProfile | null) => UserProfile | null) => void;
  onLogout: () => void;
};

export function ProfileHeaderSection({
  user,
  isAdmin,
  profileDisplayName,
  profileFallbackSeed,
  companionsCount,
  memberTypeLabels,
  memberTypeColors,
  onUserUpdated,
  onLogout,
}: HeaderProps) {
  return (
    <>
      <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 w-full max-w-[390px] items-center justify-between px-4">
          <Link href="/" className="flex h-12 items-center">
            <Image alt="SDS Surfing logo" className="h-auto w-[78px]" height={716} priority src="/logo.png" width={1148} />
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Link
                className="rounded-xl bg-[var(--brand-primary-soft-strong)] px-3 py-2 text-xs font-bold text-[var(--brand-primary-text)] transition-colors hover:bg-[var(--brand-primary-soft-accent)]"
                href="/admin/login"
              >
                관리자
              </Link>
            ) : null}
            <button
              className="brand-button-secondary rounded-xl px-3 py-2 text-xs font-bold transition-colors"
              onClick={onLogout}
              type="button"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <section className="flex flex-col items-center pt-0 sm:pt-2">
        <ProfileImageUploader
          currentImage={user?.profileImage ?? null}
          fallbackSeed={profileFallbackSeed}
          onUpdated={(updatedUser) => {
            onUserUpdated((prev) => (prev ? { ...prev, ...updatedUser } : prev));
          }}
        />
        <h1 className="mt-3 text-xl font-extrabold text-[var(--brand-text)] sm:mt-4">{profileDisplayName}</h1>
        <p className="brand-text-subtle mt-1 text-xs">가입일 {user ? new Date(user.createdAt).toLocaleDateString("ko-KR") : ""}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2 sm:mt-3">
          {user?.memberType ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${memberTypeColors[user.memberType] || "brand-chip-soft"}`}>
              {memberTypeLabels[user.memberType] || user.memberType}
            </span>
          ) : null}
          <span className="rounded-full bg-[var(--brand-primary-soft-strong)] px-2 py-0.5 text-xs font-bold text-[var(--brand-primary-text)]">
            모임 {user?._count?.participants ?? 0}회
          </span>
          {companionsCount > 0 ? (
            <span className="brand-chip-companion rounded-full px-2 py-0.5 text-xs font-bold">
              동반인 {companionsCount}명
            </span>
          ) : null}
          {(user?.penaltyCount ?? 0) > 0 ? (
            <span className="brand-chip-danger rounded-full px-2 py-0.5 text-xs font-bold">
              패널티 {user?.penaltyCount}회
            </span>
          ) : null}
        </div>
      </section>
    </>
  );
}

export function ProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: "profile" | "companions";
  onChange: (nextTab: "profile" | "companions") => void;
}) {
  return (
    <div className="brand-tab-bar">
      <div className="flex">
        <button
          className={`flex-1 border-b-2 px-2 py-3 text-base font-bold transition-colors ${
            activeTab === "profile" ? "brand-tab-underline-active" : "brand-tab-underline-inactive"
          }`}
          onClick={() => onChange("profile")}
          type="button"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[17px]">📝</span>
            <span>기본 정보</span>
          </span>
        </button>
        <button
          className={`flex-1 border-b-2 px-2 py-3 text-base font-bold transition-colors ${
            activeTab === "companions" ? "brand-tab-underline-active" : "brand-tab-underline-inactive"
          }`}
          onClick={() => onChange("companions")}
          type="button"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[17px]">👥</span>
            <span>동반인 관리</span>
          </span>
        </button>
      </div>
    </div>
  );
}

type InfoFormProps = {
  isRegular: boolean;
  isCompanionWithoutOwner: boolean;
  saving: boolean;
  saved: boolean;
  profileSaveValid: boolean;
  name: string;
  phoneNumber: string;
  userMemberType: string;
  regularMembers: RegularMember[];
  selectedOwnerKakaoId: string | null;
  ownerCompanions: OwnerCompanion[];
  loadingOwnerCompanions: boolean;
  selectedCompanionId: number | null;
  linkedCompanionInfo: LinkedCompanionInfo | null;
  selectedProfileCompanion: OwnerCompanion | null;
  memberTypeLabels: MemberTypeLabels;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onNameChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  onSelectOwner: (value: string) => void;
  onSelectCompanion: (value: number) => void;
};

export function BasicProfileSection({
  isRegular,
  isCompanionWithoutOwner,
  saving,
  saved,
  profileSaveValid,
  name,
  phoneNumber,
  userMemberType,
  regularMembers,
  selectedOwnerKakaoId,
  ownerCompanions,
  loadingOwnerCompanions,
  selectedCompanionId,
  linkedCompanionInfo,
  selectedProfileCompanion,
  memberTypeLabels,
  onSubmit,
  onNameChange,
  onPhoneNumberChange,
  onSelectOwner,
  onSelectCompanion,
}: InfoFormProps) {
  return (
    <form id="profile-form" onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
      <div className="brand-card-soft rounded-2xl p-5 sm:p-6">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">이름</label>
            <input
              type="text"
              value={isRegular ? name : (selectedProfileCompanion?.name ?? name)}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={isRegular ? "동호회에서 사용할 이름" : "소속 정회원과 내 이름을 먼저 선택하세요"}
              className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none ${
                isRegular ? "brand-input" : "brand-input-dimmed"
              }`}
              disabled={!isRegular}
            />
            {!isRegular ? (
              <p className="brand-text-subtle mt-1.5 text-xs">
                동반인 이름은 정회원이 등록한 실명 엔트리를 그대로 사용합니다.
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
              연락처 <span className="brand-text-subtle font-normal">(선택)</span>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => onPhoneNumberChange(e.target.value)}
              placeholder="010-0000-0000"
              className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">회원 유형</label>
            <div className="brand-input-dimmed rounded-xl px-4 py-2.5 text-sm font-semibold">
              {memberTypeLabels[userMemberType] ?? "정회원"}
            </div>
          </div>

          {!isRegular ? (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                소속 정회원 <span className="text-[var(--brand-error)]">*</span>
              </label>
              {isCompanionWithoutOwner ? (
                <div className="brand-panel-white mb-2 rounded-xl px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--brand-text)]">소속 정회원을 선택해 연결을 완료하세요.</p>
                </div>
              ) : null}
              {regularMembers.length === 0 ? (
                <div className="brand-panel-white rounded-xl px-4 py-3">
                  <p className="brand-text-subtle text-center text-xs">등록된 정회원이 없습니다</p>
                </div>
              ) : (
                <div className="brand-list-scroll max-h-32 space-y-1.5 overflow-y-auto rounded-xl p-2">
                  {regularMembers.map((member) => (
                    <button
                      key={member.kakaoId}
                      type="button"
                      onClick={() => onSelectOwner(member.kakaoId)}
                      className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm leading-none transition-colors ${
                        selectedOwnerKakaoId === member.kakaoId
                          ? "bg-[var(--brand-primary-soft-strong)] font-semibold text-[var(--brand-primary-text)]"
                          : "brand-list-item brand-list-item-hover"
                      }`}
                    >
                      <span className="block truncate text-[var(--brand-text)]">{member.name || "이름 없음"}</span>
                    </button>
                  ))}
                </div>
              )}
              {linkedCompanionInfo?.linked && linkedCompanionInfo.companion ? (
                <p className="brand-text-subtle mt-2 text-xs">
                  현재 연결: {linkedCompanionInfo.companion.owner.name || "이름 없음"}
                </p>
              ) : null}
            </div>
          ) : null}

          {!isRegular && selectedOwnerKakaoId ? (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                내 이름 선택 <span className="text-[var(--brand-error)]">*</span>
              </label>
              {loadingOwnerCompanions ? (
                <p className="brand-text-subtle py-2 text-center text-xs">불러오는 중...</p>
              ) : (
                <div className="space-y-1.5">
                  {ownerCompanions
                    .filter((companion) => !companion.linkedKakaoId || companion.id === linkedCompanionInfo?.companion?.id)
                    .map((companion) => (
                      <button
                        key={companion.id}
                        type="button"
                        onClick={() => {
                          onSelectCompanion(companion.id);
                          onNameChange(companion.name);
                        }}
                        className={`brand-select-card w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                          selectedCompanionId === companion.id
                            ? "brand-toggle-active border-[var(--brand-primary-border-strong)] font-semibold"
                            : "text-[var(--brand-text)]"
                        }`}
                      >
                        {companion.name}
                      </button>
                    ))}
                  {!ownerCompanions.filter((companion) => !companion.linkedKakaoId || companion.id === linkedCompanionInfo?.companion?.id).length ? (
                    <p className="brand-text-subtle py-2 text-center text-xs">선택 가능한 동반인 이름이 없습니다</p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className={`hidden w-full rounded-xl py-3.5 text-sm font-bold transition-all sm:block ${
          saving || !profileSaveValid
            ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]"
            : saved
              ? "brand-button-confirm"
              : "brand-button-primary active:scale-[0.99]"
        }`}
      >
        {saving ? "저장 중..." : saved ? "저장 완료!" : isCompanionWithoutOwner ? "소속 정회원 연결하기" : "프로필 저장하기"}
      </button>
    </form>
  );
}

type CompanionManagementProps = {
  companions: CompanionItem[];
  addCompanionName: string;
  addingCompanion: boolean;
  onNameChange: (value: string) => void;
  onAddCompanion: () => void;
  onRemoveCompanion: (id: number) => void;
};

export function CompanionManagementSection({
  companions,
  addCompanionName,
  addingCompanion,
  onNameChange,
  onAddCompanion,
  onRemoveCompanion,
}: CompanionManagementProps) {
  return (
    <div className="brand-card-soft rounded-2xl p-6">
      <div className="mb-4 flex min-w-0 gap-2">
        <input
          type="text"
          value={addCompanionName}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddCompanion();
            }
          }}
          placeholder="동반인 이름 입력"
          className="brand-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
        />
        <button
          type="button"
          onClick={onAddCompanion}
          disabled={addingCompanion || !addCompanionName.trim()}
          className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            addingCompanion || !addCompanionName.trim()
              ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]"
              : "brand-button-primary active:scale-[0.99]"
          }`}
        >
          {addingCompanion ? "..." : "추가"}
        </button>
      </div>

      {companions.length === 0 ? (
        <div className="py-4 text-center">
          <p className="brand-text-subtle text-sm">등록된 동반인이 없습니다</p>
          <p className="brand-text-subtle mt-1 text-xs">이름을 입력하여 동반인을 추가하세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {companions.map((companion) => (
            <div key={companion.id} className="brand-list-item flex items-center gap-3 rounded-xl p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--brand-text)]">{companion.name}</p>
                {"linkedKakaoId" in companion && companion.linkedKakaoId ? (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="brand-chip-success rounded px-1.5 py-0.5 text-[10px] font-bold">카카오 연동</span>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onRemoveCompanion(companion.id)}
                className="brand-text-subtle px-2 py-1 text-xs transition-colors hover:text-[var(--brand-error)]"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileProfileSaveDock({
  visible,
  saving,
  saved,
  profileSaveValid,
  isCompanionWithoutOwner,
}: {
  visible: boolean;
  saving: boolean;
  saved: boolean;
  profileSaveValid: boolean;
  isCompanionWithoutOwner: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="brand-bottom-dock fixed inset-x-0 bottom-0 z-40 backdrop-blur sm:hidden">
      <div className="mx-auto w-full max-w-[390px] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <button
          className={`w-full rounded-xl py-3.5 text-sm font-bold transition-all ${
            saving || !profileSaveValid
              ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]"
              : saved
                ? "brand-button-confirm"
                : "brand-button-primary active:scale-[0.99]"
          }`}
          disabled={saving || !profileSaveValid}
          form="profile-form"
          type="submit"
        >
          {saving ? "저장 중..." : saved ? "저장 완료!" : isCompanionWithoutOwner ? "소속 정회원 연결하기" : "프로필 저장하기"}
        </button>
      </div>
    </div>
  );
}
