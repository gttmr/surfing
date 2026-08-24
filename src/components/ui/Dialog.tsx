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
  description?: ReactNode;
  children: ReactNode;
  variant?: "dialog" | "sheet";
  closeLabel?: string;
  className?: string;
  footer?: ReactNode;
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
  footer,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!dialog.open) dialog.showModal();
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    return () => {
      if (dialog.open && dialog.isConnected) dialog.close();
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    };
  }, [open]);

  if (!open) return null;

  const sheet = variant === "sheet";

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      className={`brand-modal-scrim fixed inset-0 z-[70] m-0 h-dvh max-h-none w-screen max-w-none border-0 px-4 text-brand-text flex ${sheet ? "items-end pt-6" : "items-start py-6"}`}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const panel = panelRef.current;
        if (!panel) return;
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
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
    >
      <div
        className={`${
          sheet
            ? footer
              ? "brand-panel-white flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl"
              : "brand-mobile-scrollbar-hidden brand-panel-white max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl pb-[calc(var(--brand-safe-bottom)+1rem)]"
            : "brand-card-soft mx-auto mt-16 max-h-[calc(100dvh-7rem)] w-full max-w-[390px] overflow-y-auto rounded-3xl p-5 shadow-avatar"
        } ${className}`}
        data-dialog-panel
        ref={panelRef}
        tabIndex={-1}
      >
        <div className={sheet ? `${footer ? "shrink-0" : "sticky top-0 z-10"} bg-brand-surface-elevated px-4 pb-3 pt-4` : "mb-4"}>
          {sheet ? <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-divider-strong" /> : null}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-brand-text" id={titleId}>{title}</h2>
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
        <div className={sheet ? footer ? "brand-mobile-scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4" : "px-4" : ""}>{children}</div>
        {sheet && footer ? (
          <div className="shrink-0 border-t border-brand-divider bg-brand-surface-glass px-4 pb-[calc(var(--brand-safe-bottom)+0.75rem)] pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

export function Sheet(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}
