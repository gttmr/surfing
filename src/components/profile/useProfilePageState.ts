"use client";

import { useCallback, useEffect, useState } from "react";

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

export interface ProfileInitialData {
  notLoggedIn: boolean;
  user?: UserProfile | null;
  companions?: CompanionItem[];
  regularMembers?: RegularMember[];
  linkedCompanionInfo?: LinkedCompanionInfo | null;
  ownerCompanions?: OwnerCompanion[];
  selectedOwnerKakaoId?: string | null;
  selectedCompanionId?: number | null;
}

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
  initialData?: ProfileInitialData;
}) {
  const initialUser = initialData?.user ?? null;
  const initialCompanions = initialData?.companions ?? [];
  const initialRegularMembers = initialData?.regularMembers ?? [];
  const initialLinkedCompanionInfo = initialData?.linkedCompanionInfo ?? null;
  const initialSelectedOwnerKakaoId = initialData?.selectedOwnerKakaoId ?? null;
  const initialSelectedCompanionId = initialData?.selectedCompanionId ?? null;
  const initialOwnerCompanions = initialData?.ownerCompanions ?? [];

  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notLoggedIn, setNotLoggedIn] = useState(Boolean(initialData?.notLoggedIn));
  const [showSetup, setShowSetup] = useState(Boolean(isSetup && initialData && !initialData.notLoggedIn));
  const [activeTab, setActiveTab] = useState<"profile" | "companions">("profile");

  const [name, setName] = useState(initialUser?.name || "");
  const [setupName, setSetupName] = useState(initialUser?.name || "");
  const [phoneNumber, setPhoneNumber] = useState(initialUser?.phoneNumber || "");
  const [setupMemberType, setSetupMemberType] = useState<"REGULAR" | "COMPANION">("REGULAR");
  const [regularMembers, setRegularMembers] = useState<RegularMember[]>(initialRegularMembers);
  const [selectedOwnerKakaoId, setSelectedOwnerKakaoId] = useState<string | null>(initialSelectedOwnerKakaoId);
  const [ownerCompanions, setOwnerCompanions] = useState<OwnerCompanion[]>(initialOwnerCompanions);
  const [loadingOwnerCompanions, setLoadingOwnerCompanions] = useState(false);
  const [selectedCompanionId, setSelectedCompanionId] = useState<number | null>(initialSelectedCompanionId);
  const [linking, setLinking] = useState(false);
  const [linkedCompanionInfo, setLinkedCompanionInfo] = useState<LinkedCompanionInfo | null>(initialLinkedCompanionInfo);
  const [companions, setCompanions] = useState<CompanionItem[]>(initialCompanions);
  const [addCompanionName, setAddCompanionName] = useState("");
  const [addingCompanion, setAddingCompanion] = useState(false);
  const [loadedOwnerKakaoId, setLoadedOwnerKakaoId] = useState<string | null>(
    initialOwnerCompanions.length > 0 ? initialSelectedOwnerKakaoId : null
  );

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;

    async function bootstrap() {
      try {
        const [profileRes, companionsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/companions"),
        ]);

        if (cancelled) return;

        if (profileRes.status === 401) {
          setNotLoggedIn(true);
          setLoading(false);
          return;
        }
        if (!profileRes.ok) {
          setLoading(false);
          return;
        }

        const [profileData, companionData] = await Promise.all([
          profileRes.json(),
          companionsRes.ok ? companionsRes.json() : [],
        ]);

        if (cancelled) return;

        setUser(profileData);
        setName(profileData.name || "");
        setSetupName(profileData.name || "");
        setPhoneNumber(profileData.phoneNumber || "");
        setCompanions(Array.isArray(companionData) ? companionData : []);
        setLoading(false);
        if (isSetup) setShowSetup(true);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [initialData, isSetup]);

  useEffect(() => {
    if (setupMemberType === "COMPANION" && regularMembers.length === 0) {
      fetch("/api/members")
        .then((response) => response.ok ? response.json() : [])
        .then((data) => setRegularMembers(data))
        .catch(() => {});
    }
  }, [setupMemberType, regularMembers.length]);

  useEffect(() => {
    if ((user?.memberType ?? "REGULAR") !== "COMPANION") return;
    if (linkedCompanionInfo && (linkedCompanionInfo.linked || regularMembers.length > 0)) return;

    Promise.all([
      regularMembers.length === 0
        ? fetch("/api/members").then((response) => response.ok ? response.json() : [])
        : Promise.resolve(regularMembers),
      fetch("/api/profile/companion-link").then((response) => response.ok ? response.json() : { linked: false }),
    ])
      .then(([members, data]: [RegularMember[], LinkedCompanionInfo]) => {
        setRegularMembers(members);
        setLinkedCompanionInfo(data);
        if (data.linked && data.companion) {
          setSelectedOwnerKakaoId(data.companion.owner.kakaoId);
          setSelectedCompanionId(data.companion.id);
          setName(data.companion.name);
        }
      })
      .catch(() => setLinkedCompanionInfo({ linked: false }));
  }, [linkedCompanionInfo, regularMembers, user?.memberType]);

  useEffect(() => {
    if (!selectedOwnerKakaoId) return;
    if (selectedOwnerKakaoId === loadedOwnerKakaoId) return;
    setLoadingOwnerCompanions(true);
    fetch(`/api/companions/by-owner?kakaoId=${encodeURIComponent(selectedOwnerKakaoId)}`)
      .then((response) => response.ok ? response.json() : [])
      .then((data) => {
        setOwnerCompanions(data);
        setLoadedOwnerKakaoId(selectedOwnerKakaoId);
        setSelectedCompanionId((prev) => (data.some((companion: OwnerCompanion) => companion.id === prev) ? prev : null));
      })
      .catch(() => setOwnerCompanions([]))
      .finally(() => setLoadingOwnerCompanions(false));
  }, [loadedOwnerKakaoId, selectedOwnerKakaoId]);

  const selectedSetupCompanion = ownerCompanions.find((companion) => companion.id === selectedCompanionId) ?? null;
  const selectedProfileCompanion = ownerCompanions.find((companion) => companion.id === selectedCompanionId) ?? null;

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
          const linkRes = await fetch("/api/companions/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companionId: selectedCompanionId }),
          });

          if (linkRes.ok) {
            const linked = await fetch("/api/profile/companion-link").then((response) =>
              response.ok ? response.json() : { linked: false }
            );
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
    const isRegular = (user?.memberType ?? "REGULAR") === "REGULAR";
    const resolvedName = isRegular ? name.trim() : (selectedProfileCompanion?.name.trim() ?? "");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: resolvedName, phoneNumber }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser(updated);
      if (!isRegular && resolvedName) {
        setName(resolvedName);
      }

      if ((updated.memberType ?? user?.memberType) === "COMPANION" && selectedCompanionId) {
        const linkRes = await fetch("/api/profile/companion-link", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companionId: selectedCompanionId }),
        });

        if (linkRes.ok) {
          const linked = await linkRes.json();
          setLinkedCompanionInfo(linked);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleAddCompanion() {
    if (!addCompanionName.trim()) return;
    setAddingCompanion(true);
    const res = await fetch("/api/companions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addCompanionName.trim() }),
    });
    if (res.ok) {
      const added = await res.json();
      setCompanions((prev) => [...prev, added]);
      setAddCompanionName("");
    }
    setAddingCompanion(false);
  }

  async function handleRemoveCompanion(id: number) {
    const res = await fetch("/api/companions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setCompanions((prev) => prev.filter((companion) => companion.id !== id));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return {
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
      setRegularMembers,
      setSelectedOwnerKakaoId,
      setSelectedCompanionId,
      setLinkedCompanionInfo,
      setAddCompanionName,
      handleSetupSave,
      handleSave,
      handleAddCompanion,
      handleRemoveCompanion,
      handleLogout,
    },
  };
}
