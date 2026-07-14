"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type AsyncStateProps = {
  kind: "loading" | "error" | "empty" | "not-found";
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
};

const ICONS = {
  loading: "progress_activity",
  error: "error",
  empty: "inbox",
  "not-found": "travel_explore",
} as const;

export function AsyncState({ kind, title, description, actionLabel, onAction, actionHref }: AsyncStateProps) {
  const content = (
    <>
      <Icon className={`text-[32px] ${kind === "loading" ? "animate-spin" : ""}`} name={ICONS[kind]} />
      <h1 className="font-headline text-lg font-extrabold text-[var(--brand-text)]">{title}</h1>
      {description ? <p className="brand-text-muted max-w-xs text-sm leading-6">{description}</p> : null}
      {actionLabel && actionHref ? (
        <Link className="brand-button-primary mt-2 inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-bold" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button className="brand-button-primary mt-2 min-h-11 rounded-2xl px-5 text-sm font-bold" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </>
  );

  return (
    <section
      aria-live={kind === "loading" ? "polite" : undefined}
      className="brand-card-soft mx-auto flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center"
      role={kind === "error" ? "alert" : "status"}
    >
      {content}
    </section>
  );
}
