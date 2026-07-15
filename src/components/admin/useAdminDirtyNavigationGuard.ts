"use client";

import { useCallback, useEffect, useRef, useState, type MouseEventHandler } from "react";

type PendingAdminLeave =
  | { readonly kind: "href"; readonly href: string }
  | { readonly kind: "logout" };

type AdminDirtyNavigationOptions = {
  readonly currentPath: string;
  readonly discardDraft: (() => void) | undefined;
  readonly isDirty: boolean;
  readonly isSaveInFlight: boolean;
  readonly logout: () => Promise<void>;
  readonly push: (href: string) => void;
};

export function useAdminDirtyNavigationGuard({
  currentPath,
  discardDraft,
  isDirty,
  isSaveInFlight,
  logout,
  push,
}: AdminDirtyNavigationOptions) {
  const [pendingLeave, setPendingLeave] = useState<PendingAdminLeave | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    function warnBeforeBrowserExit(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeBrowserExit);
    return () => window.removeEventListener("beforeunload", warnBeforeBrowserExit);
  }, [isDirty]);

  useEffect(() => {
    if ((!isSaveInFlight && isDirty) || pendingLeave === null) return;
    const frame = window.requestAnimationFrame(() => {
      setPendingLeave(null);
      triggerRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isDirty, isSaveInFlight, pendingLeave]);

  const onNavigate = useCallback<MouseEventHandler<HTMLAnchorElement>>((event) => {
    if (isSaveInFlight) {
      event.preventDefault();
      return;
    }
    const opensSeparateContext = event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey;
    if (!isDirty || opensSeparateContext || event.defaultPrevented) return;

    const href = event.currentTarget.getAttribute("href");
    if (!href || new URL(href, window.location.href).pathname === currentPath) return;
    event.preventDefault();
    triggerRef.current = event.currentTarget;
    setPendingLeave({ kind: "href", href });
  }, [currentPath, isDirty, isSaveInFlight]);

  const requestLogout = useCallback<MouseEventHandler<HTMLButtonElement>>((event) => {
    if (isSaveInFlight) {
      event.preventDefault();
      return;
    }
    if (!isDirty) {
      void logout();
      return;
    }
    triggerRef.current = event.currentTarget;
    setPendingLeave({ kind: "logout" });
  }, [isDirty, isSaveInFlight, logout]);

  const stay = useCallback(() => {
    const trigger = triggerRef.current;
    setPendingLeave(null);
    window.requestAnimationFrame(() => trigger?.focus());
  }, []);

  const discardAndContinue = useCallback(() => {
    if (isSaveInFlight || !pendingLeave) return;
    discardDraft?.();
    setPendingLeave(null);
    switch (pendingLeave.kind) {
      case "href":
        push(pendingLeave.href);
        return;
      case "logout":
        void logout();
        return;
    }
  }, [discardDraft, isSaveInFlight, logout, pendingLeave, push]);

  return {
    dialogOpen: isDirty && !isSaveInFlight && pendingLeave !== null,
    discardAndContinue,
    onNavigate,
    requestLogout,
    stay,
  };
}
