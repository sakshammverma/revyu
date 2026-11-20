"use client";

import { Sheet } from "@/components/ui/kit";
import { OBJECTIONS, SAY, cueReady, fillCue, type CueVars } from "@/lib/marketing/salesScript";
import type { DeckStep } from "@/lib/marketing/salesTypes";

/** The cues for one step, filled in; the opener leads the first step. Lines missing a value are dropped. */
export function cuesFor(step: DeckStep, vars: CueVars): string[] {
  const lines = step === "gap" ? [...SAY.open, ...SAY.gap] : SAY[step];
  return lines.filter((l) => cueReady(l, vars)).map((l) => fillCue(l, vars));
}

/** The "Say this" strip under the top bar: the presenter's talk track for this step. */
export function CueStrip({ step, vars }: { step: DeckStep; vars: CueVars }) {
  const lines = cuesFor(step, vars);
  return (
    <div id="say-this" className="border-b border-line bg-accent-50 px-4 py-3 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-hover">Say this</p>
      <ul className="mt-1.5 flex flex-col gap-1 max-h-[22dvh] overflow-y-auto">
        {lines.map((l) => (
          <li key={l} className="text-sm leading-snug text-ink">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The objections drawer: the owner's words, then a short honest answer. */
export function ObjectionsSheet({ open, onClose, vars }: { open: boolean; onClose: () => void; vars: CueVars }) {
  return (
    <Sheet open={open} title="Objections" onClose={onClose}>
      <ul className="flex flex-col divide-y divide-line">
        {OBJECTIONS.map((o) => {
          // Price not loaded: drop the per-day clause rather than show a placeholder or a guess.
          const raw = cueReady(o.a, vars) ? fillCue(o.a, vars) : fillCue(o.a, vars).replace(/About \{perDay\} a day; /, "");
          const a = raw.charAt(0).toUpperCase() + raw.slice(1);
          return (
            <li key={o.q} className="py-3.5 first:pt-0 last:pb-0">
              <p className="font-semibold text-ink">&ldquo;{o.q}&rdquo;</p>
              <p className="mt-1 text-sm leading-relaxed text-text-2">{a}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 rounded-[var(--r-control)] bg-paper-subtle px-3 py-2.5 text-xs leading-relaxed text-text-2">
        Never promise review numbers, a rating or a rank. Never say &ldquo;only happy customers&rdquo;. Never post on the
        owner&rsquo;s listing, even as a test.
      </p>
    </Sheet>
  );
}
