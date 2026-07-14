"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = "info", onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  function close() {
    setVisible(false);
    window.setTimeout(onClose, 300);
  }

  useEffect(() => {
    const closeTimer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(onClose, 300);
    }, duration);
    return () => window.clearTimeout(closeTimer);
  }, [duration, onClose]);

  const colorClass = {
    success: "brand-toast-success",
    error: "brand-toast-error",
    info: "brand-toast-info",
  }[type];

  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  return (
    <div
      aria-atomic="true"
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`fixed bottom-6 right-6 z-[80] flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-brand
        transition-all duration-300 ${colorClass} ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      role={type === "error" ? "alert" : "status"}
    >
      <span aria-hidden className="text-base">{icons[type]}</span>
      <span>{message}</span>
      <button aria-label="알림 닫기" className="ml-1 flex h-11 w-11 items-center justify-center rounded-full opacity-80 hover:opacity-100" onClick={close} type="button">
        <span aria-hidden>✕</span>
      </button>
    </div>
  );
}

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: ToastItem["type"] = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
