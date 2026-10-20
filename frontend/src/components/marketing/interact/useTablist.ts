"use client";

import type { KeyboardEvent } from "react";

// Roving-tabindex props for a tablist (arrow keys, Home/End).
export function useTablist(count: number, active: number, select: (i: number) => void, id: string) {
  const onKeyDown = (e: KeyboardEvent) => {
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (active + 1) % count
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (active - 1 + count) % count
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? count - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  return {
    listProps: { role: "tablist" as const, onKeyDown },
    tabProps: (i: number) => ({
      id: `${id}-tab-${i}`,
      role: "tab" as const,
      "aria-selected": active === i,
      "aria-controls": `${id}-panel`,
      tabIndex: active === i ? 0 : -1,
    }),
    panelProps: { id: `${id}-panel`, role: "tabpanel" as const, "aria-labelledby": `${id}-tab-${active}` },
  };
}
