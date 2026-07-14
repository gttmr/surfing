"use client";

import { useEffect } from "react";

export function ConfirmationAddressCleaner() {
  useEffect(() => {
    if (!window.location.search) return;
    const cleanAddress = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", cleanAddress);
  }, []);

  return null;
}
