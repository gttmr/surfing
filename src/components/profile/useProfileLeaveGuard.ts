"use client";

import { useCallback, useEffect, useState, type MouseEventHandler } from "react";

type ProfileTab = "profile" | "companions";

type PendingLeave =
  | { readonly kind: "href"; readonly href: string }
  | { readonly kind: "tab"; readonly tab: ProfileTab }
  | { readonly kind: "logout" };

type LeaveGuardOptions = {
  readonly activeTab: ProfileTab;
  readonly discardDraft: () => void;
  readonly isDirty: boolean;
  readonly logout: () => Promise<void>;
  readonly push: (href: string) => void;
  readonly setActiveTab: (tab: ProfileTab) => void;
};

export function useProfileLeaveGuard({
  activeTab,
  discardDraft,
  isDirty,
  logout,
  push,
  setActiveTab,
}: LeaveGuardOptions) {
  const [pendingLeave, setPendingLeave] = useState<PendingLeave | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    function warnBeforeBrowserExit(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeBrowserExit);
    return () => window.removeEventListener("beforeunload", warnBeforeBrowserExit);
  }, [isDirty]);

  const onNavigate = useCallback<MouseEventHandler<HTMLAnchorElement>>((event) => {
    const opensSeparateContext = event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey;
    if (!isDirty || opensSeparateContext || event.defaultPrevented) return;

    const href = event.currentTarget.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    setPendingLeave({ kind: "href", href });
  }, [isDirty]);

  const requestTab = useCallback((tab: ProfileTab) => {
    if (tab === activeTab) return;
    if (isDirty) {
      setPendingLeave({ kind: "tab", tab });
      return;
    }
    setActiveTab(tab);
  }, [activeTab, isDirty, setActiveTab]);

  const requestLogout = useCallback(() => {
    if (isDirty) {
      setPendingLeave({ kind: "logout" });
      return;
    }
    void logout();
  }, [isDirty, logout]);

  const stay = useCallback(() => setPendingLeave(null), []);

  const discardAndContinue = useCallback(() => {
    if (!pendingLeave) return;
    discardDraft();
    setPendingLeave(null);
    switch (pendingLeave.kind) {
      case "href":
        push(pendingLeave.href);
        return;
      case "tab":
        setActiveTab(pendingLeave.tab);
        return;
      case "logout":
        void logout();
        return;
    }
  }, [discardDraft, logout, pendingLeave, push, setActiveTab]);

  return {
    dialogOpen: pendingLeave !== null,
    discardAndContinue,
    onNavigate,
    requestLogout,
    requestTab,
    stay,
  };
}
