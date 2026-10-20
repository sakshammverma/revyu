"use client";

import { useEffect, useState } from "react";

// Idle: invites the first touch. After the first real interaction it confirms
// briefly ("You're driving") and then collapses away.
export function TryHint({ label, done, className = "" }: { label: string; done: boolean; className?: string }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 1600);
    return () => clearTimeout(t);
  }, [done]);

  if (gone) return <span aria-live="polite" className="sr-only" />;
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-v2-btn ${
        done ? "bg-success-50 text-success-strong" : "afford-ring bg-white text-ink border border-accent/40"
      } ${className}`}
    >
      {done ? (
        <>✓ You&apos;re driving</>
      ) : (
        <>
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" className="text-accent-hover" fill="currentColor">
            <path d="M5 3l14 8-6 2-2 6z" />
          </svg>
          {label}
        </>
      )}
    </span>
  );
}
