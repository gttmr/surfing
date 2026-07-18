"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabItem<T extends string> = {
  id: T;
  label: ReactNode;
};

type TabsProps<T extends string> = {
  label: string;
  items: readonly TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  children: ReactNode;
  className?: string;
  listClassName?: string;
  tabClassName?: string;
  panelClassName?: string;
};

export function Tabs<T extends string>({
  label,
  items,
  activeId,
  onChange,
  children,
  className = "",
  listClassName = "",
  tabClassName = "",
  panelClassName = "",
}: TabsProps<T>) {
  const generatedId = useId().replaceAll(":", "");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));

  function selectAt(index: number) {
    const item = items[index];
    if (!item) return;
    onChange(item.id);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectAt(nextIndex);
  }

  return (
    <div className={className}>
      <div aria-label={label} className={`brand-tab-bar flex items-end ${listClassName}`} role="tablist">
        {items.map((item, index) => {
          const selected = index === activeIndex;
          const tabId = `${generatedId}-tab-${item.id}`;
          const panelId = `${generatedId}-panel-${item.id}`;
          return (
            <button
              aria-controls={panelId}
              aria-selected={selected}
              className={`border-b-2 transition-colors ${selected ? "brand-tab-underline-active" : "brand-tab-underline-inactive"} ${tabClassName}`}
              id={tabId}
              key={item.id}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(node) => { tabRefs.current[index] = node; }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${generatedId}-tab-${activeId}`}
        className={panelClassName}
        id={`${generatedId}-panel-${activeId}`}
        role="tabpanel"
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
