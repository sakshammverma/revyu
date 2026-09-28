"use client";

import { useMemo, useState } from "react";
import { StarRating } from "@/components/flow/StarRating";
import { TagChips } from "@/components/flow/TagChips";
import { assembleDraft } from "@/lib/flow/draft";
import { getDemoVertical } from "@/lib/marketing/demo";

const DEMO_TAGS = getDemoVertical("general").tags.filter((t) =>
  ["general-0", "general-1", "general-5"].includes(t.id),
);

const DEMO_SESSION_ID = "homepage-demo";

export function PhoneDemo() {
  const [rating, setRating] = useState<number | null>(5);
  const [selected, setSelected] = useState<Set<string>>(new Set(["general-0", "general-1"]));
  const [copied, setCopied] = useState(false);

  const tagConfigs = useMemo(
    () => DEMO_TAGS.map((t, i) => ({ id: t.id, label: t.label, phrases: t.phrases, sort_order: i })),
    []
  );

  const draft = useMemo(() => {
    if (selected.size === 0) return "";
    const chosen = DEMO_TAGS.filter((t) => selected.has(t.id));
    return assembleDraft(chosen, { businessName: "Sharma General Store", vertical: "general" }, DEMO_SESSION_ID);
  }, [selected]);

  function handleCopy() {
    if (!draft) return;
    navigator.clipboard?.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center">
      {/* Smartphone Frame */}
      <div className="relative w-full max-w-[340px] bg-zinc-900 rounded-[44px] p-3 shadow-2xl border-4 border-zinc-800">
        {/* Notch / Speaker */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-zinc-950 rounded-full z-20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-800 mr-2.5" />
          <div className="w-10 h-1.5 rounded-full bg-zinc-800" />
        </div>

        {/* Screen Content */}
        <div className="bg-paper rounded-[34px] overflow-hidden min-h-[520px] flex flex-col pt-7 pb-6 px-4 sm:px-5 border border-zinc-200/20">
          {/* Status bar */}
          <div className="flex justify-between items-center text-[11px] font-mono text-ink-muted mb-4 px-1">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <div className="w-5 h-2.5 border border-ink-muted rounded-sm p-0.5 flex items-center">
                <div className="w-3 h-1.5 bg-ink-muted rounded-xs" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 flex-1">
            {/* Header / Outlet info */}
            <div className="border-b border-line pb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-positive" />
                <p className="font-mono text-xs uppercase tracking-wider text-brand font-semibold">
                  Sharma General Store
                </p>
              </div>
              <p className="text-[11px] text-ink-muted mt-0.5">Google Review Flow · Verified QR</p>
            </div>

            {/* Prompt */}
            <div>
              <p className="heading text-lg font-bold text-ink">How was your visit?</p>
              <p className="text-xs text-ink-muted mt-0.5">Tap to rate</p>
            </div>

            {/* Star Rating */}
            <div className="bg-white rounded-xl p-1.5 border border-line shadow-xs">
              <StarRating value={rating} onChange={setRating} />
            </div>

            {/* Tags Section */}
            {rating !== null && (
              <div className="flex flex-col gap-1.5 mt-0.5">
                <p className="text-xs font-semibold text-ink">What stood out?</p>
                <TagChips
                  tags={tagConfigs}
                  selected={selected}
                  onToggle={(id) => {
                    const next = new Set(selected);
                    next.has(id) ? next.delete(id) : next.add(id);
                    setSelected(next);
                  }}
                />
              </div>
            )}

            {/* Live Assembled Draft Box */}
            {draft ? (
              <div className="mt-1 bg-white rounded-xl border border-brand/30 p-3 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-brand font-bold">
                    Generated review draft
                  </span>
                  <span className="text-[10px] text-positive font-mono font-medium">Editable</span>
                </div>
                <p className="text-xs text-ink leading-relaxed font-sans italic bg-paper-subtle p-2.5 rounded-lg border border-line/60">
                  &ldquo;{draft}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full mt-0.5 py-2 px-3 rounded-lg bg-cta hover:bg-cta-hover text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copied ? (
                    <span>✓ Copied to clipboard!</span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy &amp; continue to Google</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="mt-1 p-3 rounded-xl border border-dashed border-line text-center text-xs text-ink-muted">
                Tap one or more chips above to watch review text assemble automatically.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Helper Callout */}
      <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-line text-xs text-ink-muted shadow-2xs">
        <span className="text-brand">⚡</span>
        <span>Interactive demo: tap stars or tags above to test live draft generation</span>
      </div>
    </div>
  );
}
