"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DEMOS, usePlayground } from "./Playground";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const MIN_KEY = "revyu.playground.minimized";
// Sections where the tracker would only be noise (the conversion zone).
const HIDE_ON = ["faq", "final-cta"];

export function PlaygroundTracker() {
  const { all } = usePlayground();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  // Only read after hydration matters: the tracker renders null until the visitor scrolls.
  const [minimized, setMinimizedState] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(MIN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [pastHero, setPastHero] = useState(false);
  const [inConversion, setInConversion] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = HIDE_ON.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      setInConversion(visible.size > 0);
    });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const count = DEMOS.filter((d) => all.has(d.id)).length;
  const complete = count === DEMOS.length;
  if (!pastHero || inConversion) return null;

  // × only shrinks the tracker to its progress ring; the ring brings it back.
  const setMinimized = (v: boolean) => {
    setMinimizedState(v);
    if (v) setOpen(false);
    try {
      sessionStorage.setItem(MIN_KEY, v ? "1" : "0");
    } catch {}
  };
  const jump = (anchor: string) => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    setOpen(false);
  };

  const R = 15;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="fixed right-3 z-40 flex flex-col items-end gap-2 sm:right-5"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {open && (
        <div
          id="playground-panel"
          role="dialog"
          aria-label="Live demos checklist"
          className="animate-hero-pop w-[min(300px,calc(100vw-1.5rem))] rounded-2xl border border-line bg-sheet p-3 shadow-v2-elevated"
        >
          {complete ? (
            <div className="p-2 text-center">
              <p className="font-display text-lg text-ink">You&apos;ve seen everything Revyu does.</p>
              <p className="mt-1 text-sm text-text-2">Now run it on your own outlet. 15 days free.</p>
              <Link href="/signup" className="btn-primary mt-3 inline-flex px-5 py-2.5 text-sm">
                <span>Start 15-day trial →</span>
              </Link>
            </div>
          ) : (
            <>
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-text-2">Try the live demos</p>
              <ul className="flex flex-col">
                {DEMOS.map((d) => {
                  const done = all.has(d.id);
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => jump(d.anchor)}
                        className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-sm text-ink hover:bg-accent-50"
                      >
                        <span
                          aria-hidden
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                            done ? "border-success bg-success text-white" : "border-line text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className={done ? "text-text-2 line-through" : "font-medium"}>{d.label}</span>
                        <span className="sr-only">{done ? "(done)" : "(not tried yet)"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (minimized) {
              setMinimized(false);
              setOpen(true);
            } else setOpen((o) => !o);
          }}
          aria-expanded={open}
          aria-controls="playground-panel"
          aria-label={`${minimized ? "Show live demos" : "Live demos"}, ${count} of ${DEMOS.length} tried`}
          className={`flex h-11 cursor-pointer items-center gap-2.5 rounded-full border border-line bg-sheet pl-1.5 pr-1.5 text-sm font-semibold text-ink shadow-v2-elevated hover:border-accent ${minimized ? "" : "sm:pr-4"}`}
        >
          <span className="relative flex h-8 w-8 items-center justify-center">
            <svg aria-hidden width="34" height="34" viewBox="0 0 34 34" className="absolute -rotate-90">
              <circle cx="17" cy="17" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle
                cx="17"
                cy="17"
                r={R}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - count / DEMOS.length)}
                style={{ transition: "stroke-dashoffset 0.4s var(--ease-enter)" }}
              />
            </svg>
            <span key={count} className="animate-hero-pop text-[11px] font-bold text-accent-hover">
              {count}/{DEMOS.length}
            </span>
          </span>
          {!minimized && <span className="hidden sm:inline">{complete ? "All demos tried" : "Try the live demos"}</span>}
        </button>
        {!minimized && (
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimize demo checklist"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-text-2 hover:bg-sheet hover:text-ink"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
