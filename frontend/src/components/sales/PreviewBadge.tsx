import type { ReactNode } from "react";

export type PreviewKind = "live" | "example";

const CHIP: Record<PreviewKind, { label: string; className: string }> = {
  live: {
    label: "Live from Google",
    className: "bg-success-50 text-success-strong border border-success/30",
  },
  example: {
    label: "Example",
    className: "bg-sheet text-text-2 border border-dashed border-line-strong",
  },
};

/**
 * Marks a card in the dashboard preview as real public Google data or as example
 * activity. The chip straddles the card's top edge and comes first in reading order,
 * so a screen reader hears what kind of numbers follow before reading them.
 */
export function PreviewBadge({
  kind,
  className = "",
  children,
}: {
  kind: PreviewKind;
  className?: string;
  children: ReactNode;
}) {
  const chip = CHIP[kind];
  return (
    <div className={`relative grid min-w-0 ${className}`}>
      <span
        className={`absolute -top-2.5 right-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5 shadow-v2-rest ${chip.className}`}
      >
        {kind === "live" && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-success" />}
        <span className="sr-only">This card: </span>
        {chip.label}
      </span>
      {children}
    </div>
  );
}
