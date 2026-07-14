"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileImageUploader } from "@/components/profile/ProfileImageUploader";
import { Tabs } from "@/components/ui/Tabs";
import { Icon } from "@/components/ui/Icon";
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
    <div className="brand-modal-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8">
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
  profileDisplayName: string;
  profileFallbackSeed: string;
  companionsCount: number;
  editable: boolean;
  memberTypeLabels: MemberTypeLabels;
  memberTypeColors: MemberTypeColors;
  onUserUpdated: (updater: (prev: UserProfile | null) => UserProfile | null) => void;
  onLogout: () => void;
};

export function ProfileHeaderSection({
  user,
  profileDisplayName,
  profileFallbackSeed,
  companionsCount,
  editable,
  memberTypeLabels,
  memberTypeColors,
  onUserUpdated,
  onLogout,
}: HeaderProps) {
  return (
    <>
      <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 w-full max-w-[430px] items-center justify-between px-4">
          <Link href="/" className="flex h-12 items-center">
            <Image alt="SDS Surfing logo" className="h-auto w-[78px]" height={716} priority src="/logo.png" width={1148} />
          </Link>
          <div className="flex items-center gap-2">
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
          editable={editable}
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

export function PersonalJourneyLinks({
  canAccessAdminPortal,
  canAccessShopPortal,
}: {
  canAccessAdminPortal: boolean;
  canAccessShopPortal: boolean;
}) {
  const links = [
    { href: "/", icon: "home", label: "모임 홈", detail: "일정과 신청 확인" },
    { href: "/settlement", icon: "receipt_long", label: "내 정산", detail: "모임별 금액 확인" },
    ...(canAccessShopPortal
      ? [{ href: "/shop", icon: "storefront", label: "샵 포털", detail: "주문과 이용 관리" }]
      : []),
    ...(canAccessAdminPortal
      ? [{ href: "/admin/login", icon: "admin_panel_settings", label: "관리자", detail: "현재 로그인으로 이동" }]
      : []),
  ];

  return (
    <nav aria-label="개인 메뉴" className="brand-card-soft rounded-3xl p-3">
      <p className="brand-text-subtle px-2 pb-2 text-xs font-bold">바로 가기</p>
      <div className="grid grid-cols-2 gap-2">
        {links.map((link) => (
          <Link className="brand-panel-white flex min-h-20 items-center gap-3 rounded-2xl p-3" href={link.href} key={link.href}>
            <span className="brand-chip-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Icon className="text-[21px]" name={link.icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-[var(--brand-text)]">{link.label}</span>
              <span className="brand-text-subtle mt-0.5 block text-[11px] leading-4">{link.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function ProfileTabs({
  activeTab,
  onChange,
  children,
}: {
  activeTab: "profile" | "companions";
  onChange: (nextTab: "profile" | "companions") => void;
  children: ReactNode;
}) {
  return (
    <Tabs
      activeId={activeTab}
      items={[
        { id: "profile", label: <span className="inline-flex items-center gap-1.5"><Icon className="text-[18px]" name="person" /><span>기본 정보</span></span> },
        { id: "companions", label: <span className="inline-flex items-center gap-1.5"><Icon className="text-[18px]" name="group" /><span>동반인 관리</span></span> },
      ]}
      label="프로필 설정"
      onChange={onChange}
      panelClassName="min-h-[23rem] pt-4 sm:min-h-[27rem]"
      tabClassName="flex-1 px-2 py-3 text-base font-bold"
    >
      {children}
    </Tabs>
  );
}

type InfoFormProps = {
  isRegular: boolean;
  isCompanionWithoutOwner: boolean;
  isEditing: boolean;
  isDirty: boolean;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
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
  onBeginEditing: () => void;
  onDiscardDraft: () => void;
};

export function BasicProfileSection({
  isRegular,
  isCompanionWithoutOwner,
  isEditing,
  isDirty,
  saving,
  saved,
  saveError,
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
  onBeginEditing,
  onDiscardDraft,
}: InfoFormProps) {
  if (!isEditing) {
    return (
      <section aria-labelledby="profile-read-heading" className="brand-card-soft rounded-3xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="brand-text-subtle text-xs font-bold">등록된 정보</p>
            <h2 className="mt-1 text-lg font-extrabold text-[var(--brand-text)]" id="profile-read-heading">
              {name || "이름을 등록해 주세요"}
            </h2>
          </div>
          <button className="brand-button-secondary inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold" onClick={onBeginEditing} type="button">
            <Icon className="text-[18px]" name="edit" />
            편집
          </button>
        </div>
        <dl className="mt-5 divide-y divide-[var(--brand-divider)] rounded-2xl bg-[var(--brand-surface-elevated)] px-4">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="brand-text-subtle text-sm">연락처</dt>
            <dd className="text-right text-sm font-semibold text-[var(--brand-text)]">{phoneNumber || "등록 안 함"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="brand-text-subtle text-sm">회원 유형</dt>
            <dd className="text-right text-sm font-semibold text-[var(--brand-text)]">{memberTypeLabels[userMemberType] ?? "정회원"}</dd>
          </div>
          {!isRegular ? (
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="brand-text-subtle text-sm">소속</dt>
              <dd className="max-w-[65%] text-right text-sm font-semibold text-[var(--brand-text)]">
                {linkedCompanionInfo?.linked && linkedCompanionInfo.companion
                  ? `${linkedCompanionInfo.companion.owner.name || "이름 없음"}님의 동반인`
                  : "연결 필요"}
              </dd>
            </div>
          ) : null}
        </dl>
        {saved ? <p aria-live="polite" className="brand-chip-success mt-4 rounded-2xl px-4 py-3 text-sm font-bold">변경 내용이 저장되었습니다.</p> : null}
        {isCompanionWithoutOwner ? (
          <button className="brand-button-primary mt-4 min-h-12 w-full rounded-2xl px-4 text-sm font-bold" onClick={onBeginEditing} type="button">
            소속 정회원 연결하기
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <form id="profile-form" onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-base font-extrabold text-[var(--brand-text)]">프로필 편집</p>
          <p className="brand-text-subtle mt-0.5 text-xs">저장하기 전에는 등록 정보가 바뀌지 않습니다.</p>
        </div>
        <button className="brand-button-secondary min-h-11 rounded-xl px-3 text-sm font-bold" onClick={onDiscardDraft} type="button">
          취소
        </button>
      </div>
      {saveError ? (
        <div className="brand-inline-danger rounded-2xl px-4 py-3 text-sm font-semibold" role="alert">{saveError}</div>
      ) : null}
      <div className="brand-card-soft rounded-2xl p-5 sm:p-6">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]" htmlFor="profile-name">이름</label>
            <input
              id="profile-name"
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
            <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]" htmlFor="profile-phone">
              연락처 <span className="brand-text-subtle font-normal">(선택)</span>
            </label>
            <input
              id="profile-phone"
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
          disabled={saving || !profileSaveValid || !isDirty}
        className={`hidden w-full rounded-xl py-3.5 text-sm font-bold transition-all sm:block ${
          saving || !profileSaveValid || !isDirty
            ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]"
            : saved
              ? "brand-button-confirm"
              : "brand-button-primary active:scale-[0.99]"
        }`}
      >
        {saving ? "저장 중..." : saved ? "저장 완료!" : !isDirty ? "변경된 내용 없음" : isCompanionWithoutOwner ? "소속 정회원 연결하기" : "변경 내용 저장하기"}
      </button>
    </form>
  );
}

type CompanionManagementProps = {
  companions: CompanionItem[];
  addCompanionName: string;
  addingCompanion: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onAddCompanion: () => void;
  onRemoveCompanion: (id: number) => void;
};

export function CompanionManagementSection({
  companions,
  addCompanionName,
  addingCompanion,
  error,
  onNameChange,
  onAddCompanion,
  onRemoveCompanion,
}: CompanionManagementProps) {
  return (
    <section aria-labelledby="companion-heading" className="brand-card-soft rounded-3xl p-5 sm:p-6">
      <div className="mb-4">
        <p className="brand-text-subtle text-xs font-bold">함께 신청할 사람</p>
        <h2 className="mt-1 text-lg font-extrabold text-[var(--brand-text)]" id="companion-heading">동반인 관리</h2>
      </div>
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
      {error ? <p className="brand-inline-danger mb-4 rounded-2xl px-4 py-3 text-sm font-semibold" role="alert">{error}</p> : null}

      {companions.length === 0 ? (
        <div className="brand-panel-white rounded-2xl px-5 py-7 text-center">
          <Icon className="brand-text-subtle text-[30px]" name="person_add" />
          <p className="mt-2 text-sm font-bold text-[var(--brand-text)]">등록된 동반인이 없습니다</p>
          <p className="brand-text-subtle mt-1 text-xs">위에 이름을 입력하면 모임 신청 때 선택할 수 있어요.</p>
        </div>
      ) : (
        <div className={`space-y-2 ${companions.length > 4 ? "brand-list-scroll max-h-[22rem] overflow-y-auto rounded-2xl p-2" : ""}`}>
          {companions.map((companion) => (
            <div key={companion.id} className="brand-list-item flex items-center gap-3 rounded-2xl p-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${companion.linkedKakaoId ? "brand-chip-success" : "brand-chip-soft"}`}>
                <Icon className="text-[20px]" name={companion.linkedKakaoId ? "link" : "link_off"} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--brand-text)]">{companion.name}</p>
                <p className={`mt-0.5 text-xs ${companion.linkedKakaoId ? "text-[var(--brand-success-text)]" : "brand-text-subtle"}`}>
                  {companion.linkedKakaoId ? "본인 계정과 연결됨" : "상대방 연결 대기"}
                </p>
              </div>
              <button
                aria-label={`${companion.name} 삭제`}
                type="button"
                onClick={() => onRemoveCompanion(companion.id)}
                className="brand-text-subtle px-2 py-1 text-xs transition-colors hover:text-[var(--brand-error)]"
              >
                <Icon className="text-[19px]" name="delete" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function MobileProfileSaveDock({
  visible,
  saving,
  saved,
  profileSaveValid,
  isCompanionWithoutOwner,
  isDirty,
}: {
  visible: boolean;
  saving: boolean;
  saved: boolean;
  profileSaveValid: boolean;
  isCompanionWithoutOwner: boolean;
  isDirty: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="brand-bottom-dock brand-mobile-fixed-bar fixed bottom-0 z-40 backdrop-blur sm:hidden">
      <div className="mx-auto w-full max-w-[390px] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <button
          className={`w-full rounded-xl py-3.5 text-sm font-bold transition-all ${
            saving || !profileSaveValid || !isDirty
              ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]"
              : saved
                ? "brand-button-confirm"
                : "brand-button-primary active:scale-[0.99]"
          }`}
          disabled={saving || !profileSaveValid || !isDirty}
          form="profile-form"
          type="submit"
        >
          {saving ? "저장 중..." : saved ? "저장 완료!" : !isDirty ? "변경된 내용 없음" : isCompanionWithoutOwner ? "소속 정회원 연결하기" : "변경 내용 저장하기"}
        </button>
      </div>
    </div>
  );
}
