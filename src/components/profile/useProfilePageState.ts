"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfileImageDraft } from "@/components/profile/ProfileImageUploader";
import { isProfileDraftDirty } from "@/lib/profile-draft";

export interface UserProfile {
  id: number;
  kakaoId: string;
  name: string | null;
  profileImage: string | null;
  kakaoProfileImage: string | null;
  customProfileImageUrl: string | null;
  phoneNumber: string | null;
  role: string;
  memberType: string;
  penaltyCount: number;
  createdAt: string;
  _count: {
    participants: number;
  };
}

export interface CompanionItem {
  id: number;
  name: string;
  ownerKakaoId: string;
  linkedKakaoId: string | null;
  createdAt: string;
}

export interface RegularMember {
  kakaoId: string;
  name: string | null;
}

export interface OwnerCompanion {
  id: number;
  name: string;
  linkedKakaoId: string | null;
}

export interface LinkedCompanionInfo {
  linked: boolean;
  companion?: {
    id: number;
    name: string;
    owner: {
      kakaoId: string;
      name: string | null;
    };
  };
}

export type ProfileInitialData =
  | { notLoggedIn: true }
  | {
      notLoggedIn: false;
      user: UserProfile;
      companions: CompanionItem[];
      regularMembers: RegularMember[];
      linkedCompanionInfo: LinkedCompanionInfo | null;
      ownerCompanions: OwnerCompanion[];
      selectedOwnerKakaoId: string | null;
      selectedCompanionId: number | null;
    };

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

export function useProfilePageState({
  isSetup,
  router,
  initialData,
}: {
  isSetup: boolean;
  router: RouterLike;
  initialData: ProfileInitialData;
}) {
  const loggedInData = initialData.notLoggedIn ? null : initialData;
  const initialUser = loggedInData?.user ?? null;
  const initialCompanions = loggedInData?.companions ?? [];
  const initialRegularMembers = loggedInData?.regularMembers ?? [];
  const initialLinkedCompanionInfo = loggedInData?.linkedCompanionInfo ?? null;
  const initialSelectedOwnerKakaoId = loggedInData?.selectedOwnerKakaoId ?? null;
  const initialSelectedCompanionId = loggedInData?.selectedCompanionId ?? null;
  const initialOwnerCompanions = loggedInData?.ownerCompanions ?? [];

  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [companionError, setCompanionError] = useState<string | null>(null);
  const notLoggedIn = initialData.notLoggedIn;
  const [showSetup, setShowSetup] = useState(Boolean(isSetup && !initialData.notLoggedIn));
  const [activeTab, setActiveTab] = useState<"profile" | "companions">("profile");

  const [name, setName] = useState(initialUser?.name || "");
  const [setupName, setSetupName] = useState(initialUser?.name || "");
  const [phoneNumber, setPhoneNumber] = useState(initialUser?.phoneNumber || "");
  const [setupMemberType, setSetupMemberType] = useState<"REGULAR" | "COMPANION">("REGULAR");
  const regularMembers = initialRegularMembers;
  const [selectedOwnerKakaoId, setSelectedOwnerKakaoId] = useState<string | null>(initialSelectedOwnerKakaoId);
  const [ownerCompanions, setOwnerCompanions] = useState<OwnerCompanion[]>(initialOwnerCompanions);
  const [loadingOwnerCompanions, setLoadingOwnerCompanions] = useState(false);
  const [selectedCompanionId, setSelectedCompanionId] = useState<number | null>(initialSelectedCompanionId);
  const [linking, setLinking] = useState(false);
  const [linkedCompanionInfo, setLinkedCompanionInfo] = useState<LinkedCompanionInfo | null>(initialLinkedCompanionInfo);
  const [companions, setCompanions] = useState<CompanionItem[]>(initialCompanions);
  const [addCompanionName, setAddCompanionName] = useState("");
  const [addingCompanion, setAddingCompanion] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<ProfileImageDraft | null>(null);
  const [loadedOwnerKakaoId, setLoadedOwnerKakaoId] = useState<string | null>(
    initialOwnerCompanions.length > 0 ? initialSelectedOwnerKakaoId : null
  );

  useEffect(() => {
    return () => {
      if (avatarDraft?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(avatarDraft.previewUrl);
      }
    };
  }, [avatarDraft]);

  useEffect(() => {
    async function loadOwnerCompanions() {
      if (!selectedOwnerKakaoId) return;
      if (selectedOwnerKakaoId === loadedOwnerKakaoId) return;
      setLoadingOwnerCompanions(true);
      try {
        const response = await fetch(`/api/companions/by-owner?kakaoId=${encodeURIComponent(selectedOwnerKakaoId)}`);
        const data = response.ok ? await response.json() : [];
        setOwnerCompanions(data);
        setLoadedOwnerKakaoId(selectedOwnerKakaoId);
        setSelectedCompanionId((prev) => (data.some((companion: OwnerCompanion) => companion.id === prev) ? prev : null));
      } catch {
        setOwnerCompanions([]);
      } finally {
        setLoadingOwnerCompanions(false);
      }
    }

    void loadOwnerCompanions();
  }, [loadedOwnerKakaoId, selectedOwnerKakaoId]);

  const selectedSetupCompanion = ownerCompanions.find((companion) => companion.id === selectedCompanionId) ?? null;
  const selectedProfileCompanion = ownerCompanions.find((companion) => companion.id === selectedCompanionId) ?? null;
  const persistedCompanionId = linkedCompanionInfo?.companion?.id ?? null;
  const persistedOwnerKakaoId = linkedCompanionInfo?.companion?.owner.kakaoId ?? null;
  const isDirty = isProfileDraftDirty({
    avatarDraftPending: avatarDraft !== null,
    draftCompanionId: selectedCompanionId,
    draftName: name,
    draftPhoneNumber: phoneNumber,
    persistedCompanionId,
    persistedName: user?.name ?? "",
    persistedPhoneNumber: user?.phoneNumber ?? "",
  });

  function beginEditing() {
    setSaveError(null);
    setIsEditing(true);
  }

  function discardDraft() {
    setName(user?.name ?? "");
    setPhoneNumber(user?.phoneNumber ?? "");
    setSelectedOwnerKakaoId(persistedOwnerKakaoId);
    setSelectedCompanionId(persistedCompanionId);
    setAvatarDraft(null);
    setSaveError(null);
    setIsEditing(false);
  }

  const handleSetupSave = useCallback(async () => {
    const resolvedSetupName =
      setupMemberType === "REGULAR"
        ? setupName.trim()
        : (selectedSetupCompanion?.name.trim() ?? "");
    if (!resolvedSetupName) return;
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: resolvedSetupName, memberType: setupMemberType, forceMemberTypeSetup: true }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUser(updated);
      setName(updated.name || resolvedSetupName);
      setSetupName(updated.name || resolvedSetupName);

      if (setupMemberType === "COMPANION" && selectedOwnerKakaoId) {
        setLinking(true);
        if (selectedCompanionId) {
          const linkRes = await fetch("/api/profile/companion-link", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companionId: selectedCompanionId }),
          });

          if (linkRes.ok) {
            const linked: LinkedCompanionInfo = await linkRes.json();
            setLinkedCompanionInfo(linked);
          }
        }
        setLinking(false);
      }

      setShowSetup(false);
      router.replace("/profile");
    }
    setSaving(false);
  }, [router, selectedCompanionId, selectedOwnerKakaoId, selectedSetupCompanion, setupMemberType, setupName]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const isRegular = (user?.memberType ?? "REGULAR") === "REGULAR";
    const resolvedName = isRegular ? name.trim() : (selectedProfileCompanion?.name.trim() ?? "");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: resolvedName, phoneNumber }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "프로필을 저장하지 못했습니다.";
        setSaveError(`${message} 입력한 내용은 그대로 남아 있습니다.`);
        return;
      }

      const responseUser: UserProfile = await res.json();
      const updated: UserProfile = user ? {
        ...responseUser,
        customProfileImageUrl: user.customProfileImageUrl,
        kakaoProfileImage: user.kakaoProfileImage,
        profileImage: user.profileImage,
      } : responseUser;
      if ((updated.memberType ?? user?.memberType) === "COMPANION" && selectedCompanionId) {
        const linkRes = await fetch("/api/profile/companion-link", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companionId: selectedCompanionId }),
        });
        if (!linkRes.ok) {
          setSaveError("프로필은 저장했지만 동반인 연결을 완료하지 못했습니다. 선택한 내용은 그대로 남아 있습니다.");
          setUser(updated);
          return;
        }
        const linked: LinkedCompanionInfo = await linkRes.json();
        setLinkedCompanionInfo(linked);
      }

      let savedUser = updated;
      if (avatarDraft) {
        const avatarFile = new File([avatarDraft.blob], "profile.webp", {
          type: avatarDraft.blob.type,
        });
        const avatarForm = new FormData();
        avatarForm.append("file", avatarFile);
        const avatarResponse = await fetch("/api/profile/avatar", {
          method: "POST",
          body: avatarForm,
        });
        const avatarPayload: unknown = await avatarResponse.json().catch(() => null);
        const avatarUser = typeof avatarPayload === "object"
          && avatarPayload !== null
          && "user" in avatarPayload
          && typeof avatarPayload.user === "object"
          && avatarPayload.user !== null
          ? avatarPayload.user
          : null;
        if (!avatarResponse.ok || !avatarUser) {
          const avatarMessage = typeof avatarPayload === "object"
            && avatarPayload !== null
            && "error" in avatarPayload
            && typeof avatarPayload.error === "string"
            ? avatarPayload.error
            : "프로필 사진을 저장하지 못했습니다.";
          setUser(updated);
          setName(updated.name ?? resolvedName);
          setPhoneNumber(updated.phoneNumber ?? "");
          setSaveError(`${avatarMessage} 사진 미리보기는 남아 있으니 다시 저장해 주세요.`);
          return;
        }
        savedUser = { ...updated, ...avatarUser };
        setAvatarDraft(null);
      }

      setUser(savedUser);
      setName(updated.name ?? resolvedName);
      setPhoneNumber(updated.phoneNumber ?? "");
      setSaved(true);
      setIsEditing(false);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error
        ? `저장 중 문제가 발생했습니다. 입력한 내용은 그대로 남아 있습니다.`
        : "프로필을 저장하지 못했습니다. 입력한 내용은 그대로 남아 있습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCompanion() {
    if (!addCompanionName.trim()) return;
    setAddingCompanion(true);
    setCompanionError(null);
    try {
      const res = await fetch("/api/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addCompanionName.trim() }),
      });
      if (!res.ok) {
        setCompanionError("동반인을 추가하지 못했습니다. 이름을 확인하고 다시 시도해 주세요.");
        return;
      }
      const added: CompanionItem = await res.json();
      setCompanions((prev) => [...prev, added]);
      setAddCompanionName("");
    } catch {
      setCompanionError("동반인을 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setAddingCompanion(false);
    }
  }

  async function handleRemoveCompanion(id: number) {
    setCompanionError(null);
    try {
      const res = await fetch("/api/companions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setCompanions((prev) => prev.filter((companion) => companion.id !== id));
        return;
      }
      setCompanionError("동반인을 삭제하지 못했습니다. 연결 상태를 확인해 주세요.");
    } catch {
      setCompanionError("동반인을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return {
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
      beginEditing,
      discardDraft,
      handleSetupSave,
      handleSave,
      handleAddCompanion,
      handleRemoveCompanion,
      handleLogout,
    },
  };
}
