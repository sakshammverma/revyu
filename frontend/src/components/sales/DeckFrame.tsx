"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CueStrip, ObjectionsSheet } from "@/components/sales/PresenterNotes";
import type { CueVars } from "@/lib/marketing/salesScript";
import { DECK_STEPS, type DeckStep } from "@/lib/marketing/salesTypes";
import { VERTICAL_OPTIONS } from "@/lib/verticals";

export const STEP_LABEL: Record<DeckStep, string> = {
  gap: "On Google today",
  try: "Your counter",
  dashboard: "Your dashboard",
  start: "Start free",
};

/**
 * The presenter's frame around each slide: a top bar (shop, step, presenter tools), the slide,
 * and a pinned bottom bar (Back, step dots, Next). Only the dashboard step scrolls inside
 * itself; the others are laid out to fit a 360x640 phone without scrolling.
 */
export function DeckFrame({
  name,
  step,
  onStep,
  vertical,
  onVertical,
  verticalBusy,
  onEnd,
  vars,
  children,
}: {
  name: string;
  step: DeckStep;
  onStep: (step: DeckStep) => void;
  vertical: string;
  onVertical: (vertical: string) => void;
  verticalBusy: boolean;
  onEnd: () => void;
  vars: CueVars;
  children: ReactNode;
}) {
  const [cuesOpen, setCuesOpen] = useState(false);
  const [objections, setObjections] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const index = DECK_STEPS.indexOf(step);
  const prev = index > 0 ? DECK_STEPS[index - 1] : null;
  const next = index < DECK_STEPS.length - 1 ? DECK_STEPS[index + 1] : null;

  // Arrow keys move between steps on a desktop, unless a field, the menu or a dialog has them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (objections || menu || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, select, textarea, [contenteditable], [role=dialog], [role=radiogroup]") !== null)) return;
      if (e.key === "ArrowRight" && next) onStep(next);
      else if (e.key === "ArrowLeft" && prev) onStep(prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onStep, objections, menu]);

  // The menu closes on Escape or a tap outside it.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // Each step starts at its top.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [step]);

  return (
    <div className="h-[100dvh] min-h-[100dvh] flex flex-col bg-bg text-ink overflow-hidden">
      <header className="shrink-0 z-20 border-b border-line bg-sheet/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 px-2 sm:px-4 min-h-[52px]">
          <div className="min-w-0 flex-1 pl-2">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="text-xs text-text-muted">
              <span className="sr-only">Step </span>
              {index + 1} of {DECK_STEPS.length}
              <span className="hidden sm:inline"> · {STEP_LABEL[step]}</span>
            </p>
          </div>
          <button
            type="button"
            aria-pressed={cuesOpen}
            aria-controls={cuesOpen ? "say-this" : undefined}
            onClick={() => setCuesOpen((v) => !v)}
            className={`min-h-[44px] px-3 rounded-[var(--r-control)] text-sm font-semibold transition-colors cursor-pointer ${
              cuesOpen ? "bg-accent-50 text-accent-hover" : "text-text-2 hover:bg-paper-subtle hover:text-ink"
            }`}
          >
            Say this
          </button>
          <button
            type="button"
            onClick={() => setObjections(true)}
            className="min-h-[44px] px-3 rounded-[var(--r-control)] text-sm font-semibold text-text-2 hover:bg-paper-subtle hover:text-ink cursor-pointer"
          >
            Objections
          </button>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Demo menu"
              aria-haspopup="true"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className="w-11 h-11 inline-flex items-center justify-center rounded-[var(--r-control)] text-text-2 hover:bg-paper-subtle hover:text-ink cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            {menu && (
              <div className="flow-step absolute right-0 top-full mt-1 w-72 rounded-[var(--r-card)] border border-line bg-sheet p-4 shadow-v2-elevated">
                <label htmlFor="deck-vertical" className="block text-sm font-semibold text-ink">
                  Category
                </label>
                <select
                  id="deck-vertical"
                  value={vertical}
                  disabled={verticalBusy}
                  onChange={(e) => onVertical(e.target.value)}
                  className="mt-1.5 w-full min-h-[44px] rounded-[var(--r-control)] border border-line-strong bg-sheet px-3 text-base text-ink outline-none focus:border-accent disabled:opacity-60"
                >
                  {VERTICAL_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-text-muted" aria-live="polite">
                  {verticalBusy ? "Updating the demo…" : "Changes the customer page's tags."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onEnd();
                  }}
                  className="mt-4 w-full min-h-[44px] rounded-[var(--r-control)] border border-line-strong text-sm font-semibold text-alert hover:bg-alert-50 cursor-pointer"
                >
                  End demo
                </button>
              </div>
            )}
          </div>
        </div>
        {cuesOpen && <CueStrip step={step} vars={vars} />}
      </header>

      <div
        ref={contentRef}
        className={`flex-1 min-h-0 overflow-x-hidden ${step === "dashboard" ? "overflow-y-auto" : "overflow-y-auto overscroll-contain"}`}
      >
        <div key={step} className="flow-step h-full">
          {children}
        </div>
      </div>

      <nav
        aria-label="Demo steps"
        className="shrink-0 z-20 border-t border-line bg-sheet/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => prev && onStep(prev)}
            disabled={!prev}
            className="min-h-[44px] min-w-[84px] whitespace-nowrap px-4 rounded-[var(--r-control)] text-sm font-semibold text-text-2 hover:bg-paper-subtle hover:text-ink disabled:invisible cursor-pointer"
          >
            ← Back
          </button>
          <ol className="flex items-center">
            {DECK_STEPS.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onStep(s)}
                  aria-current={s === step ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${STEP_LABEL[s]}`}
                  className="group w-9 h-11 inline-flex items-center justify-center cursor-pointer"
                >
                  <span
                    aria-hidden
                    className={`block h-2 rounded-full transition-all duration-300 ${
                      s === step ? "w-6 bg-accent" : "w-2 bg-line-strong group-hover:bg-text-muted"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ol>
          {next ? (
            <button
              type="button"
              onClick={() => onStep(next)}
              className="min-h-[44px] min-w-[84px] whitespace-nowrap px-5 rounded-[var(--r-control)] bg-accent text-sm font-semibold text-white shadow-v2-btn hover:bg-accent-hover cursor-pointer"
            >
              {next === "start" ? "Start" : "Next"} →
            </button>
          ) : (
            <span aria-hidden className="min-w-[84px]" />
          )}
        </div>
      </nav>

      <ObjectionsSheet open={objections} onClose={() => setObjections(false)} vars={vars} />
    </div>
  );
}
