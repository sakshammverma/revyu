"use client";

import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type GhostPoint = { x: string; y: string };

// A pointer that demonstrates the gesture once, then fades. `onStep(i)` fires as it
// lands on each point so the demo can show the genuine effect. Decorative only.
export function GhostHand({
  path,
  play,
  onStep,
  stepMs = 900,
}: {
  path: GhostPoint[];
  play: boolean;
  onStep?: (i: number) => void;
  stepMs?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(-1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!play || reduced || done) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    path.forEach((_, n) => {
      timers.push(setTimeout(() => setI(n), 400 + n * stepMs));
      if (onStep) timers.push(setTimeout(() => onStep(n), 400 + n * stepMs + stepMs * 0.55));
    });
    timers.push(
      setTimeout(() => {
        setDone(true);
        setI(-1);
      }, 400 + path.length * stepMs + 300),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced]);

  if (reduced || done || i < 0) return null;
  const p = path[i];
  return (
    <span
      aria-hidden
      className="ghost-hand pointer-events-none absolute z-30"
      style={{
        left: p.x,
        top: p.y,
        transition: `left ${stepMs * 0.5}ms var(--ease-enter), top ${stepMs * 0.5}ms var(--ease-enter)`,
      }}
    >
      <span key={i} className="ghost-ripple absolute -left-5 -top-5 h-10 w-10 rounded-full border-2 border-accent bg-accent/25" />
      <svg width="26" height="26" viewBox="0 0 24 24" className="relative drop-shadow-md">
        <path d="M5 3l14 8-6 2-2 6z" fill="#1a1e23" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
