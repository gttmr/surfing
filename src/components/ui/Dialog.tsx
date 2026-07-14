"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  variant?: "dialog" | "sheet";
  closeLabel?: string;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  variant = "dialog",
  closeLabel = "닫기",
  className = "",
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  if (!open) return null;

  const sheet = variant === "sheet";

  return (
    <div
      className={`brand-modal-scrim fixed inset-0 z-[70] flex px-4 ${sheet ? "items-end pt-6" : "items-start py-6"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`${
          sheet
            ? "brand-panel-white max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl pb-[calc(var(--brand-safe-bottom)+1rem)]"
            : "brand-card-soft mx-auto mt-16 max-h-[calc(100dvh-7rem)] w-full max-w-[390px] overflow-y-auto rounded-3xl p-5 shadow-avatar"
        } ${className}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className={sheet ? "sticky top-0 z-10 bg-[var(--brand-surface-elevated)] px-4 pb-3 pt-4" : "mb-4"}>
          {sheet ? <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--brand-divider-strong)]" /> : null}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-[var(--brand-text)]" id={titleId}>{title}</h2>
              {description ? <p className="brand-text-subtle mt-1 text-xs" id={descriptionId}>{description}</p> : null}
            </div>
            <button
              aria-label={closeLabel}
              className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              onClick={onClose}
              type="button"
            >
              <Icon className="text-[20px]" name="close" />
            </button>
          </div>
        </div>
        <div className={sheet ? "px-4" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function Sheet(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}
