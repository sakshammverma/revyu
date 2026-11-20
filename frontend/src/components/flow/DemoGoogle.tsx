"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FlowButton } from "@/components/flow/Button";
import { StarRating } from "@/components/flow/StarRating";

/**
 * The /demo walkthrough's stand-in for Google's review box. It is plainly
 * labelled as a stand-in and uses none of Google's branding. It exists so a
 * shop owner can feel the one step Revyu doesn't control: the customer picks
 * their own stars, pastes and posts from their own account.
 */
export function DemoGoogle({
  businessName,
  backHref = "/demo",
}: {
  businessName: string;
  /** Where to go when there is no history to go back to (the flow page this stands in for). */
  backHref?: string;
}) {
  const [stars, setStars] = useState<number | null>(null);
  const [text, setText] = useState("");
  const router = useRouter();

  function goBack() {
    // Back, not a fresh link: the flow page then knows the customer has returned.
    if (window.history.length > 1) window.history.back();
    else router.replace(backHref);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="px-3 py-2 rounded-lg bg-paper-subtle/60 border border-dashed border-line-strong text-xs text-text-2 text-center">
        Demo stand-in. With a real code, your Google review page opens here.
      </p>

      <div className="v2-sheet border border-line p-5 sm:p-8 flex flex-col gap-4">
        <div className="pb-4 border-b border-line">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Reviewing on Google</p>
          <h1 className="font-display text-2xl leading-tight tracking-tight text-ink mt-1">{businessName}</h1>
          <p className="text-sm text-text-2 mt-1.5">Posted publicly, under the customer&rsquo;s own Google account.</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink mb-1">1. They choose their own stars</p>
          <div className="px-2 bg-paper-subtle/50 rounded-2xl border border-line">
            <StarRating key={stars ?? 0} value={stars} onChange={setStars} groupLabel="Choose a star rating" />
          </div>
        </div>

        <div>
          <label htmlFor="demo-google-text" className="text-sm font-semibold text-ink">
            2. They paste their draft
          </label>
          <p className="text-xs text-text-2 mt-0.5 mb-1.5">Press and hold in the box, then tap Paste. Your draft is on the clipboard.</p>
          <textarea
            id="demo-google-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share details of your own experience at this place"
            className="w-full min-h-[120px] rounded-xl border border-line-strong bg-white p-4 text-base leading-relaxed text-ink placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 transition-colors"
          />
        </div>

        <FlowButton variant="primary" onClick={goBack}>
          Post (demo) and go back
        </FlowButton>
        <button type="button" onClick={goBack} className="min-h-[44px] text-sm font-semibold text-text-2 cursor-pointer self-center">
          ← Back without posting
        </button>
      </div>

      <p className="text-xs text-text-muted leading-relaxed text-center px-4">
        Revyu never posts for anyone and can&rsquo;t pre-fill Google&rsquo;s box. Nothing typed here is saved or sent.
      </p>
    </div>
  );
}
